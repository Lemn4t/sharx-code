// Package install downloads official Telemt release binaries from github.com/telemt/telemt.
package install

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/konstpic/sharx-code/v2/config"
	"github.com/konstpic/sharx-code/v2/logger"
)

const (
	repoAPI    = "https://api.github.com/repos/telemt/telemt/releases"
	releaseURL = "https://github.com/telemt/telemt/releases/download"
)

type releaseAsset struct {
	Name string `json:"name"`
}

type releaseEntry struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
}

// ResolveBinaryPath returns the Telemt executable path used by panel and worker.
func ResolveBinaryPath() string {
	if p := strings.TrimSpace(os.Getenv("TELEMT_BIN")); p != "" {
		return p
	}
	if bin := strings.TrimSpace(config.GetBinFolderPath()); bin != "" {
		p := filepath.Join(bin, "telemt")
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p
		}
	}
	for _, c := range []string{"/app/bin/telemt", "bin/telemt", "./bin/telemt"} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	if bin := strings.TrimSpace(config.GetBinFolderPath()); bin != "" {
		return filepath.Join(bin, "telemt")
	}
	return "bin/telemt"
}

func archDownloadSuffix() (string, error) {
	switch runtime.GOARCH {
	case "amd64":
		return "x86_64-linux-musl", nil
	case "arm64":
		return "aarch64-linux-musl", nil
	default:
		return "", fmt.Errorf("unsupported GOARCH for Telemt musl builds: %s", runtime.GOARCH)
	}
}

// ListVersions returns release tags from GitHub (newest first), e.g. "3.4.13".
func ListVersions() ([]string, error) {
	client := &http.Client{Timeout: 2 * time.Minute}
	req, err := http.NewRequest(http.MethodGet, repoAPI, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "sharx-panel")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var releases []releaseEntry
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(releases))
	for _, r := range releases {
		tag := strings.TrimSpace(strings.TrimPrefix(r.TagName, "v"))
		if tag == "" {
			continue
		}
		suffix, err := archDownloadSuffix()
		if err != nil {
			continue
		}
		want := fmt.Sprintf("telemt-%s.tar.gz", suffix)
		found := false
		for _, a := range r.Assets {
			if a.Name == want {
				found = true
				break
			}
		}
		if found {
			out = append(out, tag)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no Telemt musl release assets found for this architecture")
	}
	return out, nil
}

// ReadVersion runs `telemt --version` on the given path (or ResolveBinaryPath when empty).
func ReadVersion(binPath string) string {
	if strings.TrimSpace(binPath) == "" {
		binPath = ResolveBinaryPath()
	}
	cmd := exec.Command(binPath, "--version")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(out))
	line = strings.TrimPrefix(line, "telemt")
	return strings.TrimSpace(line)
}

// Install downloads version from GitHub releases and replaces destPath.
func Install(version, destPath string) error {
	version = strings.TrimSpace(strings.TrimPrefix(version, "v"))
	if version == "" {
		return fmt.Errorf("telemt version is required")
	}
	if strings.TrimSpace(destPath) == "" {
		destPath = ResolveBinaryPath()
	}

	suffix, err := archDownloadSuffix()
	if err != nil {
		return err
	}
	asset := fmt.Sprintf("telemt-%s.tar.gz", suffix)
	checksumFile := asset + ".sha256"
	base := fmt.Sprintf("%s/%s", version, asset)
	url := fmt.Sprintf("%s/%s/%s", releaseURL, version, asset)
	sumURL := fmt.Sprintf("%s/%s/%s", releaseURL, version, checksumFile)

	client := &http.Client{Timeout: 5 * time.Minute}
	tgz, err := downloadBytes(client, url)
	if err != nil {
		return fmt.Errorf("download %s: %w", base, err)
	}
	sumBody, err := downloadBytes(client, sumURL)
	if err != nil {
		return fmt.Errorf("download checksum: %w", err)
	}
	if err := verifySHA256(tgz, sumBody); err != nil {
		return err
	}

	bin, err := extractTelemtBinary(tgz)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}
	tmp := destPath + fmt.Sprintf(".tmp.%d", time.Now().UnixNano())
	if err := os.WriteFile(tmp, bin, 0o755); err != nil {
		return err
	}
	_ = os.Remove(destPath)
	if err := os.Rename(tmp, destPath); err != nil {
		_ = os.Remove(tmp)
		return err
	}

	dataDir := config.GetDataFolderPath()
	if dataDir != "" {
		_ = os.MkdirAll(dataDir, 0o755)
		_ = os.WriteFile(filepath.Join(dataDir, "telemt-version.txt"), []byte(version), 0o644)
	}

	logger.Infof("Telemt %s installed to %s", version, destPath)
	return nil
}

func downloadBytes(client *http.Client, url string) ([]byte, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	const maxSize = 64 << 20
	limited := io.LimitReader(resp.Body, maxSize+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if len(data) > maxSize {
		return nil, fmt.Errorf("download too large")
	}
	return data, nil
}

func verifySHA256(data, checksumFile []byte) error {
	line := strings.Fields(strings.TrimSpace(string(checksumFile)))
	if len(line) < 1 {
		return fmt.Errorf("invalid checksum file")
	}
	wantHex := strings.ToLower(line[0])
	sum := sha256.Sum256(data)
	gotHex := hex.EncodeToString(sum[:])
	if !strings.EqualFold(gotHex, wantHex) {
		return fmt.Errorf("sha256 mismatch: got %s want %s", gotHex, wantHex)
	}
	return nil
}

func extractTelemtBinary(tgz []byte) ([]byte, error) {
	gzr, err := gzip.NewReader(bytes.NewReader(tgz))
	if err != nil {
		return nil, err
	}
	defer gzr.Close()
	tr := tar.NewReader(gzr)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}
		base := filepath.Base(hdr.Name)
		if base != "telemt" {
			continue
		}
		const maxBin = 32 << 20
		data, err := io.ReadAll(io.LimitReader(tr, maxBin+1))
		if err != nil {
			return nil, err
		}
		if len(data) > maxBin {
			return nil, fmt.Errorf("telemt binary too large")
		}
		return data, nil
	}
	return nil, fmt.Errorf("telemt binary not found in archive")
}
