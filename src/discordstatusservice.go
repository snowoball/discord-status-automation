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
    Active          bool        `json:"active"`
    PresetID        int         `json:"preset_id"`
    IntervalSeconds int         `json:"interval_seconds"`
    Location        []Location  `json:"location"`
}

type Status struct {
	ID     string   `json:"status_id"`
	Emoji  string   `json:"status_emoji"`
	Text   string   `json:"status_text"`
	Tags   []string `json:"tags"`
}

type PresetSequence struct {
	Sequence  int         `json:"sequence"`
	Type      string      `json:"type"` // static, random, none
	TagFilter string      `json:"tagFilter"`
	Status    interface{} `json:"status"` // can be number or array
}

type Preset struct {
	ID       int              `json:"id"`
	Name     string           `json:"name"`
	Statuses []PresetSequence `json:"statuses"`
}

// ---------- GLOBALS ----------

var (
	lastSettingsData []byte
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
func getTimeBasedEmoji(lat, lon float64) (emoji, text, timestamp string) {
	now := time.Now()
	sunriseTime, sunsetTime := sunrise.SunriseSunset(lat, lon, now.Year(), now.Month(), now.Day())

	morningEnd := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, now.Location())
	eveningStart := time.Date(now.Year(), now.Month(), now.Day(), 18, 0, 0, 0, now.Location())

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
	if len(settings.Location) > 0 {
		lat, lon = settings.Location[0].Latitude, settings.Location[0].Longitude
	} else {
		lat, lon = 50.8503, 4.3517 // fallback: Brussels
	}

	// --- Time-based values ---
	timeEmoji, timeText, timestampText := getTimeBasedEmoji(lat, lon)

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

	settingsPath := "configuration/settings.json"
	presetsPath := "configuration/presets.json"
	statusesPath := "configuration/statuses.json"

	var settings []Settings
	var presets []Preset
	var statuses []Status

	loadConfigs := func() bool {
		err1 := readJSONFile(settingsPath, &settings)
		err2 := readJSONFile(presetsPath, &presets)
		err3 := readJSONFile(statusesPath, &statuses)
		if err1 != nil || err2 != nil || err3 != nil {
			log.Println("❌ Error reading config files:", err1, err2, err3)
			return false
		}
		return true
	}

	if !loadConfigs() {
		return
	}

	sequenceCounter := 0
	var lastPresetID int = -1
	log.Println("🚀 Discord Status Rotator started...")

	for {
		reload := fileChanged(settingsPath, &lastSettingsData)
		if reload {
			log.Println("🔄 Configuration changed, reloading...")
			if loadConfigs() {
				sequenceCounter = 0
				lastPresetID = -1
			}
		}

		if len(settings) == 0 {
			time.Sleep(5 * time.Second)
			continue
		}

		current := settings[0]
		if !current.Active {
			time.Sleep(time.Duration(current.IntervalSeconds) * time.Second)
			continue
		}

		if current.PresetID != lastPresetID {
			log.Printf("🎚️ Switched to preset %d\n", current.PresetID)
			lastPresetID = current.PresetID
			sequenceCounter = 0
		}

		var preset *Preset
		for i := range presets {
			if presets[i].ID == current.PresetID {
				preset = &presets[i]
				break
			}
		}

		if preset == nil {
			log.Println("❌ Preset not found")
			time.Sleep(time.Duration(current.IntervalSeconds) * time.Second)
			continue
		}

		if sequenceCounter >= len(preset.Statuses) {
			sequenceCounter = 0
		}

		entry := preset.Statuses[sequenceCounter]
		sequenceCounter++

		var emoji string
		var textsToSend []string

		switch entry.Type {
		case "static":
			id := fmt.Sprintf("%v", entry.Status)
			for i := range statuses {
				if statuses[i].ID == id {
					emoji = statuses[i].Emoji
					textsToSend = strings.Split(statuses[i].Text, "\n")
					break
				}
			}
		case "random":
			arr, ok := entry.Status.([]interface{})
			if ok && len(arr) > 0 {
				randIndex := rand.Intn(len(arr))
				id := fmt.Sprintf("%v", arr[randIndex])
				for i := range statuses {
					if statuses[i].ID == id {
						emoji = statuses[i].Emoji
						textsToSend = strings.Split(statuses[i].Text, "\n")
						break
					}
				}
			}
		case "none":
			// Execute empty status (emoji="", text="")
			textsToSend = []string{""}
		default:
			log.Println("⚠️ Unknown sequence type:", entry.Type)
			textsToSend = []string{""}
		}

		// Loop through sub-lines (sub-loop)
		for _, t := range textsToSend {
			emoji, t = ReplaceStatusVariables(emoji, t, current)

			UpdateDiscordStatus(emoji, t)

			if fileChanged(settingsPath, &lastSettingsData) {
				log.Println("🔄 Configuration changed mid-cycle, reloading...")
				if loadConfigs() {
					sequenceCounter = 0
					lastPresetID = -1
				}
				break
			}

			time.Sleep(time.Duration(current.IntervalSeconds) * time.Second)
		}
	}
}
