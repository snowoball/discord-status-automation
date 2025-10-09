package src

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// =======================
// === Struct Objects ====
// =======================

// --- active.json ---
type Web_Settings struct {
	Active             bool `json:"active"`
	PresetID           int  `json:"preset_id"`
	StatusSequenceNum  int  `json:"status_sequence_number"`
}

// --- presets.json ---
type Web_PresetStatus struct {
	Sequence int         `json:"sequence"`
	Type     string      `json:"type"`
	Web_Status   interface{} `json:"status,omitempty"` // can be int or []int
}

type Web_Preset struct {
	ID       int            `json:"id"`
	Name     string         `json:"name"`
	Statuses []Web_PresetStatus `json:"statuses"`
}

// --- statuses.json ---
type Web_Status struct {
	StatusID     string `json:"status_id"`
	StatusEmoji  string `json:"status_emoji"`
	StatusText   string `json:"status_text"`
}

// =======================
// === Start Server ======
// =======================

func StartWebServer() {
	go func() {
		staticDir := "src/www/"
		configDir := "configuration/"

		mux := http.NewServeMux()

		// API routes
		mux.HandleFunc("/api/config/", func(w http.ResponseWriter, r *http.Request) {
			handleConfigRequest(w, r, configDir)
		})

		// Serve static frontend
		fs := http.FileServer(http.Dir(staticDir))
		mux.Handle("/", fs)

		port := ":8080"
		fmt.Printf("Serving %s on http://localhost%s\n", staticDir, port)
		if err := http.ListenAndServe(port, mux); err != nil {
			fmt.Printf("Web server error: %v\n", err)
		}
	}()
}

// =======================
// === API Handlers ======
// =======================

// GET/POST /api/config/{type}
func handleConfigRequest(w http.ResponseWriter, r *http.Request, configDir string) {
	// Extract config type (active/presets/statuses)
	configType := filepath.Base(r.URL.Path)

	var filename string
	switch configType {
	case "settings":
		filename = "settings.json"
	case "presets":
		filename = "presets.json"
	case "statuses":
		filename = "statuses.json"
	default:
		http.Error(w, "Unknown configuration type", http.StatusBadRequest)
		return
	}

	fullPath := filepath.Join(configDir, filename)

	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(fullPath)
		if err != nil {
			http.Error(w, "Failed to read configuration file", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)

	case http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// Sanity check: ensure JSON structure matches expected object
		if !validateConfigJSON(configType, body) {
			http.Error(w, "Invalid JSON structure", http.StatusBadRequest)
			return
		}

		// Write file (overwrite existing)
		err = os.WriteFile(fullPath, body, 0644)
		if err != nil {
			http.Error(w, "Failed to write configuration file", http.StatusInternalServerError)
			return
		}

		resp := APIResponse{Web_Status: "ok", Message: fmt.Sprintf("%s configuration updated", configType)}
		writeJSON(w, http.StatusOK, resp)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// =======================
// === JSON Validation ===
// =======================

func validateConfigJSON(configType string, data []byte) bool {
	switch configType {
	case "settings":
		var entries []Web_Settings
		return json.Unmarshal(data, &entries) == nil
	case "presets":
		var entries []Web_Preset
		return json.Unmarshal(data, &entries) == nil
	case "statuses":
		var entries []Web_Status
		return json.Unmarshal(data, &entries) == nil
	default:
		return false
	}
}

// =======================
// === Helper Utilities ==
// =======================

type APIResponse struct {
	Web_Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
