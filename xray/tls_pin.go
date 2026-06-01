package xray

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"os"
	"strings"
)

// LeafCertSHA256Hex returns the SHA-256 fingerprint of the first PEM certificate block
// (Xray pinnedPeerCertSha256 format: lowercase hex, no colons).
func LeafCertSHA256Hex(cert *x509.Certificate) string {
	sum := sha256.Sum256(cert.Raw)
	return hex.EncodeToString(sum[:])
}

// LeafCertSHA256FromPEM parses PEM and returns the pin for the first certificate block.
func LeafCertSHA256FromPEM(pemData string) (string, error) {
	cert, err := firstCertificateFromPEM(pemData)
	if err != nil {
		return "", err
	}
	return LeafCertSHA256Hex(cert), nil
}

// LeafCertSHA256FromFile reads a PEM/DER certificate file and returns its pin.
func LeafCertSHA256FromFile(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("certificate file path is empty")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read certificate file: %w", err)
	}
	if pin, err := LeafCertSHA256FromPEM(string(raw)); err == nil {
		return pin, nil
	}
	cert, err := x509.ParseCertificate(raw)
	if err != nil {
		return "", fmt.Errorf("parse certificate: %w", err)
	}
	return LeafCertSHA256Hex(cert), nil
}

func firstCertificateFromPEM(pemData string) (*x509.Certificate, error) {
	data := []byte(strings.TrimSpace(pemData))
	for len(data) > 0 {
		block, rest := pem.Decode(data)
		if block == nil {
			break
		}
		data = rest
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse certificate: %w", err)
		}
		return cert, nil
	}
	return nil, fmt.Errorf("no CERTIFICATE block found in PEM")
}
