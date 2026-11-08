package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type config struct {
	port            string
	githubToken     string
	repo            string // owner/name
	baseBranch      string
	turnstileSecret string
	editorKey       string
	allowedOrigins  []string
}

func loadConfig() config {
	cfg := config{
		port:            envOr("PORT", "8080"),
		githubToken:     strings.TrimSpace(os.Getenv("GITHUB_TOKEN")),
		repo:            envOr("GITHUB_REPO", "scoutalessandria2/canzoniere"),
		baseBranch:      envOr("GITHUB_BASE_BRANCH", "main"),
		turnstileSecret: strings.TrimSpace(os.Getenv("TURNSTILE_SECRET")),
		editorKey:       strings.TrimSpace(os.Getenv("EDITOR_KEY")),
	}
	for _, o := range splitAndTrim(envOr("ALLOWED_ORIGINS", "https://canzoniereal2.alessandriascout.it")) {
		cfg.allowedOrigins = append(cfg.allowedOrigins, o)
	}
	return cfg
}

func main() {
	cfg := loadConfig()
	if cfg.githubToken == "" {
		log.Fatal("GITHUB_TOKEN is required")
	}
	if cfg.turnstileSecret == "" {
		log.Println("WARNING: TURNSTILE_SECRET not set, bot verification is disabled")
	}

	srv := &server{
		cfg:     cfg,
		gh:      newGitHubClient(cfg.githubToken, cfg.repo),
		limiter: newRateLimiter(10, time.Minute),
	}

	mux := http.NewServeMux()
	// /healthz is intercepted by Google's frontend on run.app domains, so the
	// health endpoint lives under a non-reserved path.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("POST /api/songs", srv.handleSongEdit)
	mux.HandleFunc("POST /api/songs/batch", srv.handleSongBatch)
	mux.HandleFunc("POST /api/suggestions", srv.handleSuggestion)
	mux.HandleFunc("GET /api/editor/ping", srv.handleEditorPing)

	handler := srv.cors(srv.rateLimit(mux))
	log.Printf("listening on :%s", cfg.port)
	log.Fatal(http.ListenAndServe(":"+cfg.port, handler))
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
