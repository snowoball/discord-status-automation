package main

import (
	"flag"
	"fmt"
	"os"
	"strconv"

	"github.com/snowoball/discord-status-automation/src"
)

func main() {
	// Default: webserver ON
	noWeb := flag.Bool("no-web", false, "Disable the configuration web server")
	flag.Parse()

	// Environment variable also works (NO_WEB=true disables)
	envVal := os.Getenv("NO_WEB")
	if envVal != "" {
		if v, err := strconv.ParseBool(envVal); err == nil {
			*noWeb = v
		}
	}

	if !*noWeb {
		fmt.Println("Starting web server in background...")
		go src.StartWebServer()
	} else {
		fmt.Println("Web server disabled.")
	}

	src.LaunchDiscordStatusRotation()
}
