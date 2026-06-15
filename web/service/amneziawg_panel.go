package service

import (
	"path/filepath"
	"sync"

	"github.com/konstpic/sharx-code/v2/config"
	"github.com/konstpic/sharx-code/v2/logger"
	"github.com/konstpic/sharx-code/v2/node/amneziawg"
)

var (
	panelAmneziaWgMu sync.Mutex
	panelAmneziaWg   *amneziawg.Manager
)

func getPanelAmneziaWg() *amneziawg.Manager {
	panelAmneziaWgMu.Lock()
	defer panelAmneziaWgMu.Unlock()
	if panelAmneziaWg == nil {
		panelAmneziaWg = amneziawg.NewManager()
		panelAmneziaWg.SetWorkRoot(filepath.Join(config.GetDataFolderPath(), "amneziawg"))
	}
	return panelAmneziaWg
}

func nodePayloadsToAmneziaWg(in []AmneziaWGNodePayload) []amneziawg.Payload {
	out := make([]amneziawg.Payload, 0, len(in))
	for _, p := range in {
		out = append(out, amneziawg.Payload{
			InboundId: p.InboundId,
			Tag:       p.Tag,
			Conf:      p.Conf,
			Iface:     p.Iface,
		})
	}
	return out
}

// StopLocalAmneziaWgStandalone stops all AmneziaWG sidecars on the panel host.
func StopLocalAmneziaWgStandalone() {
	panelAmneziaWgMu.Lock()
	defer panelAmneziaWgMu.Unlock()
	if panelAmneziaWg != nil {
		panelAmneziaWg.Stop()
		panelAmneziaWg = nil
	}
}

// StopLocalAmneziaWgSidecars stops children without niling the manager.
func StopLocalAmneziaWgSidecars() {
	panelAmneziaWgMu.Lock()
	defer panelAmneziaWgMu.Unlock()
	if panelAmneziaWg != nil {
		panelAmneziaWg.Stop()
	}
}

// ApplyLocalAmneziaWgStandalone syncs AmneziaWG processes when multi-node mode is off.
func ApplyLocalAmneziaWgStandalone(xs *XrayService) error {
	if xs == nil {
		xs = &XrayService{settingService: SettingService{}, inboundService: InboundService{}, nodeService: NodeService{}}
	}
	multi, err := xs.settingService.GetMultiNodeMode()
	if err != nil {
		multi = false
	}
	if multi {
		return nil
	}
	payloads, err := BuildAmneziaWgPayloadsStandalone()
	if err != nil {
		return err
	}
	if len(payloads) == 0 {
		StopLocalAmneziaWgStandalone()
		return nil
	}
	return getPanelAmneziaWg().Apply(nodePayloadsToAmneziaWg(payloads))
}

// TryApplyLocalAmneziaWgStandalone logs failures instead of returning.
func TryApplyLocalAmneziaWgStandalone(xs *XrayService) {
	if err := ApplyLocalAmneziaWgStandalone(xs); err != nil {
		logger.Warningf("standalone AmneziaWG: %v", err)
	}
}
