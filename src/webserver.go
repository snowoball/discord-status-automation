package src

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// =======================
// === Start Server ======
// =======================

func StartWebServer() {
	go func() {
		staticDir := "src/www/"
		configPath := "configuration/config.json"

		mux := http.NewServeMux()

		// API routes - single config endpoint
		mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
			handleConfigRequest(w, r, configPath)
		})

		// API route for sequence type schemas
		mux.HandleFunc("/api/types", func(w http.ResponseWriter, r *http.Request) {
			handleTypesRequest(w, r)
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

// GET/PUT /api/config
func handleConfigRequest(w http.ResponseWriter, r *http.Request, configPath string) {
	switch r.Method {
	case http.MethodGet:
		data, err := os.ReadFile(configPath)
		if err != nil {
			http.Error(w, "Failed to read configuration file", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)

	case http.MethodPut, http.MethodPost:
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		// Validate JSON structure
		var config Config
		if err := json.Unmarshal(body, &config); err != nil {
			http.Error(w, "Invalid JSON structure: "+err.Error(), http.StatusBadRequest)
			return
		}

		// Write file (overwrite existing)
		err = os.WriteFile(configPath, body, 0644)
		if err != nil {
			http.Error(w, "Failed to write configuration file", http.StatusInternalServerError)
			return
		}

		resp := APIResponse{Status: "ok", Message: "Configuration updated"}
		writeJSON(w, http.StatusOK, resp)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// GET /api/types - Returns available sequence type schemas
func handleTypesRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	schemas := GetAllTypeSchemas()
	writeJSON(w, http.StatusOK, schemas)
}

// =======================
// === Helper Utilities ==
// =======================

type APIResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
