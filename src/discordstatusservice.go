package src

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/nathan-osman/go-sunrise"
)

// ---------- CONFIG STRUCTS ----------

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type Settings struct {
	Active          bool     `json:"active"`
	ActivePresetID  int      `json:"activePresetId"`
	IntervalSeconds int      `json:"intervalSeconds"`
	Location        Location `json:"location"`
	Timezone        string   `json:"timezone"`
}

type Status struct {
	ID    int      `json:"id"`
	Emoji string   `json:"emoji"`
	Text  string   `json:"text"`
	Tags  []string `json:"tags"`
}

type SequenceItem struct {
	Type   string                 `json:"type"` // Type identifier (static, random, none, schedule, weekday, conditional)
	Params map[string]interface{} `json:"params,omitempty"` // Type-specific parameters
}

type Preset struct {
	ID       int            `json:"id"`
	Name     string         `json:"name"`
	Sequence []SequenceItem `json:"sequence"`
}

type Config struct {
	Settings Settings `json:"settings"`
	Statuses []Status `json:"statuses"`
	Presets  []Preset `json:"presets"`
}

// ---------- GLOBALS ----------

var (
	lastConfigData []byte
)

// ---------- HELPERS ----------

func readJSONFile[T any](path string, target *T) error {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func fileChanged(path string, last *[]byte) bool {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return false
	}
	if string(data) != string(*last) {
		*last = data
		return true
	}
	return false
}

// getTimeBasedEmoji returns a day-phase emoji, descriptive text, and current timestamp
func getTimeBasedEmoji(lat, lon float64, timezone string) (emoji, text, timestamp string) {
	// Load timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		log.Printf("⚠️ Failed to load timezone '%s', using local time: %v\n", timezone, err)
		loc = time.Local
	}
	
	now := time.Now().In(loc)
	sunriseTime, sunsetTime := sunrise.SunriseSunset(lat, lon, now.Year(), now.Month(), now.Day())

	morningEnd := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, loc)
	eveningStart := time.Date(now.Year(), now.Month(), now.Day(), 18, 0, 0, 0, loc)

	switch {
	case now.Before(sunriseTime):
		emoji, text = "🌙", "Night"
	case now.After(sunriseTime) && now.Before(morningEnd):
		emoji, text = "🌅", "Morning"
	case now.After(morningEnd) && now.Before(eveningStart):
		emoji, text = "☀️", "Day"
	case now.After(eveningStart) && now.Before(sunsetTime):
		emoji, text = "🌇", "Evening"
	default:
		emoji, text = "🌙", "Night"
	}

	timestamp = now.Format("03:04 PM")
	return
}

// getWeatherStatus fetches current weather for given coordinates
func getWeatherStatus(lat, lon float64) (text, emoji string) {
	url := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&current_weather=true", lat, lon)
	client := http.Client{Timeout: 5 * time.Second}

	resp, err := client.Get(url)
	if err != nil {
		return "Weather unavailable", "🌫️"
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "Weather unavailable", "🌫️"
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "Weather error", "🌫️"
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "Weather error", "🌫️"
	}

	current, ok := result["current_weather"].(map[string]interface{})
	if !ok {
		return "Weather data missing", "🌫️"
	}

	temp := fmt.Sprintf("%.1f°C", current["temperature"])
	code, _ := current["weathercode"].(float64)

	wmo := map[int](struct {
		desc  string
		emoji string
	}){
		0:  {"Clear sky", "☀️"},
		1:  {"Mainly clear", "🌤️"},
		2:  {"Partly cloudy", "⛅"},
		3:  {"Overcast", "☁️"},
		45: {"Fog", "🌫️"},
		48: {"Rime fog", "🌫️"},
		51: {"Light drizzle", "🌦️"},
		53: {"Moderate drizzle", "🌦️"},
		55: {"Dense drizzle", "🌧️"},
		61: {"Slight rain", "🌦️"},
		63: {"Moderate rain", "🌧️"},
		65: {"Heavy rain", "🌧️"},
		71: {"Slight snow", "🌨️"},
		73: {"Moderate snow", "🌨️"},
		75: {"Heavy snow", "❄️"},
		80: {"Rain showers", "🌧️"},
		85: {"Snow showers", "🌨️"},
		95: {"Thunderstorm", "⛈️"},
		96: {"Thunderstorm with hail", "⛈️"},
		99: {"Thunderstorm with heavy hail", "🌩️"},
	}

	c, ok := wmo[int(code)]
	if !ok {
		c = struct {
			desc  string
			emoji string
		}{"Unknown", "🌫️"}
	}

	return fmt.Sprintf("%s %s", temp, c.desc), c.emoji
}

func ReplaceStatusVariables(emoji, text string, settings Settings) (string, string) {
	var lat, lon float64
	lat, lon = settings.Location.Latitude, settings.Location.Longitude
	if lat == 0 && lon == 0 {
		lat, lon = 50.8503, 4.3517 // fallback: Brussels
	}
	
	// Get timezone (default to UTC if not specified)
	timezone := settings.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	// --- Time-based values ---
	timeEmoji, timeText, timestampText := getTimeBasedEmoji(lat, lon, timezone)

	// --- Weather-based values ---
	weatherText, weatherEmoji := getWeatherStatus(lat, lon)

	// --- Replace all variables in both emoji & text ---
	replacements := map[string]string{
		"{{time_emoji}}":     timeEmoji,
		"{{time_text}}":      timeText,
		"{{timestamp_text}}": timestampText,
		"{{weather_emoji}}":  weatherEmoji,
		"{{weather_text}}":   weatherText,
	}

	for key, val := range replacements {
		emoji = strings.ReplaceAll(emoji, key, val)
		text = strings.ReplaceAll(text, key, val)
	}

	return emoji, text
}

// ---------- DISCORD API ----------

func UpdateDiscordStatus(emoji, text string) bool {
	_ = godotenv.Load(".env")
	tokens := []string{}

	if val := os.Getenv("DISCORD_TOKENS"); val != "" {
		for _, t := range strings.FieldsFunc(val, func(r rune) bool { return r == ',' || r == '\n' || r == ';' }) {
			tokens = append(tokens, strings.TrimSpace(t))
		}
	}

	if len(tokens) == 0 {
		log.Println("❌ No DISCORD_TOKENS found in .env")
		return false
	}

	success := true
	for _, token := range tokens {
		payload := map[string]interface{}{
			"custom_status": map[string]string{
				"text":       text,
				"emoji_name": emoji,
			},
		}
		body, _ := json.Marshal(payload)
		req, _ := http.NewRequest("PATCH", "https://discord.com/api/v10/users/@me/settings", strings.NewReader(string(body)))
		req.Header.Set("Authorization", token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil || resp.StatusCode >= 300 {
			log.Printf("❌ Failed to update status for token (HTTP %v)\n", resp.Status)
			success = false
		} else {
			log.Printf("✅ Updated status: %s %s\n", emoji, text)
		}
		if resp != nil {
			resp.Body.Close()
		}
	}
	return success
}

// ---------- MAIN ROTATION LOOP ----------

func LaunchDiscordStatusRotation() {
	rand.Seed(time.Now().UnixNano())

	configPath := "configuration/config.json"
	var config Config

	loadConfig := func() bool {
		err := readJSONFile(configPath, &config)
		if err != nil {
			log.Println("❌ Error reading config file:", err)
			return false
		}
		return true
	}

	if !loadConfig() {
		return
	}

	sequenceCounter := 0
	var lastPresetID int = -1
	log.Println("🚀 Discord Status Rotator started...")

	for {
		reload := fileChanged(configPath, &lastConfigData)
		if reload {
			log.Println("🔄 Configuration changed, reloading...")
			if loadConfig() {
				sequenceCounter = 0
				lastPresetID = -1
			}
		}

		if !config.Settings.Active {
			time.Sleep(time.Duration(config.Settings.IntervalSeconds) * time.Second)
			continue
		}

		if config.Settings.ActivePresetID != lastPresetID {
			log.Printf("🎚️ Switched to preset %d\n", config.Settings.ActivePresetID)
			lastPresetID = config.Settings.ActivePresetID
			sequenceCounter = 0
		}

		var preset *Preset
		for i := range config.Presets {
			if config.Presets[i].ID == config.Settings.ActivePresetID {
				preset = &config.Presets[i]
				break
			}
		}

		if preset == nil {
			log.Println("❌ Preset not found")
			time.Sleep(time.Duration(config.Settings.IntervalSeconds) * time.Second)
			continue
		}

		if sequenceCounter >= len(preset.Sequence) {
			sequenceCounter = 0
		}

		item := preset.Sequence[sequenceCounter]
		sequenceCounter++

		// Get the sequence type handler
		typeHandler := GetSequenceType(item.Type)
		if typeHandler == nil {
			log.Printf("⚠️ Unknown sequence type: %s\n", item.Type)
			time.Sleep(time.Duration(config.Settings.IntervalSeconds) * time.Second)
			continue
		}

		// Check if this sequence should execute based on its conditions
		if !typeHandler.ShouldExecute(item.Params, config.Settings) {
			log.Printf("⏭️ Skipping sequence (conditions not met): %s\n", item.Type)
			time.Sleep(time.Duration(config.Settings.IntervalSeconds) * time.Second)
			continue
		}

		// Select status based on type logic
		selectedStatusID := typeHandler.SelectStatus(item.Params, config.Statuses)

		var emoji string
		var textsToSend []string

		if selectedStatusID != nil {
			// Find the status by ID
			for i := range config.Statuses {
				if config.Statuses[i].ID == *selectedStatusID {
					emoji = config.Statuses[i].Emoji
					textsToSend = strings.Split(config.Statuses[i].Text, "\n")
					break
				}
			}
		} else {
			// No status selected (e.g., "none" type)
			textsToSend = []string{""}
		}

		// Loop through sub-lines (sub-loop)
		for _, t := range textsToSend {
			emoji, t = ReplaceStatusVariables(emoji, t, config.Settings)

			UpdateDiscordStatus(emoji, t)

			if fileChanged(configPath, &lastConfigData) {
				log.Println("🔄 Configuration changed mid-cycle, reloading...")
				if loadConfig() {
					sequenceCounter = 0
					lastPresetID = -1
				}
				break
			}

			time.Sleep(time.Duration(config.Settings.IntervalSeconds) * time.Second)
		}
	}
}
