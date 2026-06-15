// Package install builds or locates the AmneziaWG-go userspace binary for panel/node images.
//
// Upstream: https://github.com/amnezia-vpn/amneziawg-go (fork of WireGuard-go, not Xray).
// Companion tools: https://github.com/amnezia-vpn/amneziawg-tools (awg, awg-quick).
package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

const defaultRepo = "https://github.com/amnezia-vpn/amneziawg-go.git"

// ResolveBinaryPath returns the amneziawg-go executable path used by panel and worker.
func ResolveBinaryPath() string {
	if p := os.Getenv("AMNEZIAWG_BIN"); p != "" {
		return p
	}
	for _, c := range []string{"/app/bin/amneziawg-go", "bin/amneziawg-go", "./bin/amneziawg-go"} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	if bin, err := exec.LookPath("amneziawg-go"); err == nil {
		return bin
	}
	return filepath.Join("bin", "amneziawg-go")
}

const defaultAwgToolsRepo = "https://github.com/amnezia-vpn/amneziawg-tools.git"

// ResolveAwgBinaryPath returns the awg userspace tool path (amneziawg-tools).
func ResolveAwgBinaryPath() string {
	if p := os.Getenv("AWG_BIN"); p != "" {
		return p
	}
	for _, c := range []string{"/app/bin/awg", "bin/awg", "./bin/awg"} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	if bin, err := exec.LookPath("awg"); err == nil {
		return bin
	}
	return filepath.Join("bin", "awg")
}

// BuildAwgFromSource builds the `awg` CLI from amneziawg-tools (output copied to destPath).
func BuildAwgFromSource(destPath, gitRef string) error {
	if destPath == "" {
		destPath = ResolveAwgBinaryPath()
	}
	if gitRef == "" {
		gitRef = "master"
	}
	tmp := filepath.Join(os.TempDir(), "amneziawg-tools-build")
	_ = os.RemoveAll(tmp)
	if err := os.MkdirAll(tmp, 0o755); err != nil {
		return err
	}
	if out, err := exec.Command("git", "clone", "--depth", "1", "--branch", gitRef, defaultAwgToolsRepo, tmp).CombinedOutput(); err != nil {
		return fmt.Errorf("git clone amneziawg-tools: %w: %s", err, out)
	}
	srcDir := filepath.Join(tmp, "src")
	if out, err := exec.Command("make", "-C", srcDir, "wg").CombinedOutput(); err != nil {
		return fmt.Errorf("make amneziawg-tools wg: %w: %s", err, out)
	}
	built := filepath.Join(srcDir, "wg")
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(built)
	if err != nil {
		return err
	}
	return os.WriteFile(destPath, data, 0o755)
}

// BuildFromSource clones amneziawg-go and runs `make` (used in Docker image build when no release asset exists).
func BuildFromSource(destPath, gitRef string) error {
	if destPath == "" {
		destPath = ResolveBinaryPath()
	}
	if gitRef == "" {
		gitRef = "master"
	}
	tmp := filepath.Join(os.TempDir(), "amneziawg-go-build")
	_ = os.RemoveAll(tmp)
	if err := os.MkdirAll(tmp, 0o755); err != nil {
		return err
	}
	if out, err := exec.Command("git", "clone", "--depth", "1", "--branch", gitRef, defaultRepo, tmp).CombinedOutput(); err != nil {
		return fmt.Errorf("git clone amneziawg-go: %w: %s", err, out)
	}
	if out, err := exec.Command("make", "-C", tmp).CombinedOutput(); err != nil {
		return fmt.Errorf("make amneziawg-go: %w: %s", err, out)
	}
	src := filepath.Join(tmp, "amneziawg-go")
	if runtime.GOOS == "windows" {
		src += ".exe"
	}
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.WriteFile(destPath, data, 0o755); err != nil {
		return err
	}
	return nil
}
