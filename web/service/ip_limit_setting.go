package service

import (
	"strings"

	"github.com/konstpic/sharx-code/v2/util/common"
)

const (
	IPLimitEnforcementDrop          = "drop"
	IPLimitEnforcementBlock         = "block"
	IPLimitEnforcementDropAndBlock  = "drop_and_block"
	IPLimitExcessPolicyNewest       = "newest"
	IPLimitExcessPolicyOldest       = "oldest"
)

func clampIPLimitCheckSec(n int) int {
	if n < 5 {
		return 5
	}
	if n > 600 {
		return 600
	}
	return n
}

func clampIPLimitBanSec(n int) int {
	if n < 0 {
		return 0
	}
	if n > 86400*30 {
		return 86400 * 30
	}
	return n
}

func (s *SettingService) GetIPLimitGlobalEnable() (bool, error) {
	v, err := s.getBool("ipLimitGlobalEnable")
	if err != nil {
		return true, err
	}
	return v, nil
}

func (s *SettingService) GetIPLimitCheckIntervalSec() (int, error) {
	n, err := s.getInt("ipLimitCheckIntervalSec")
	if err != nil {
		return 30, err
	}
	return clampIPLimitCheckSec(n), nil
}

func (s *SettingService) GetIPLimitBanDurationSec() (int, error) {
	n, err := s.getInt("ipLimitBanDurationSec")
	if err != nil {
		return 3600, err
	}
	return clampIPLimitBanSec(n), nil
}

func (s *SettingService) GetIPLimitEnforcement() (string, error) {
	mode, err := s.getString("ipLimitEnforcement")
	if err != nil {
		return IPLimitEnforcementDropAndBlock, err
	}
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case IPLimitEnforcementDrop, IPLimitEnforcementBlock, IPLimitEnforcementDropAndBlock:
		return strings.ToLower(strings.TrimSpace(mode)), nil
	default:
		return IPLimitEnforcementDropAndBlock, nil
	}
}

func (s *SettingService) GetIPLimitExcessPolicy() (string, error) {
	p, err := s.getString("ipLimitExcessPolicy")
	if err != nil {
		return IPLimitExcessPolicyNewest, err
	}
	switch strings.ToLower(strings.TrimSpace(p)) {
	case IPLimitExcessPolicyNewest, IPLimitExcessPolicyOldest:
		return strings.ToLower(strings.TrimSpace(p)), nil
	default:
		return IPLimitExcessPolicyNewest, nil
	}
}

// ValidateIPLimitSettings checks panel IP limit settings from AllSetting-like values.
func ValidateIPLimitSettings(checkSec, banSec int, enforcement, excessPolicy string) error {
	if checkSec != 0 && (checkSec < 5 || checkSec > 600) {
		return common.NewErrorf("ipLimitCheckIntervalSec must be between 5 and 600 seconds")
	}
	if banSec < 0 || banSec > 86400*30 {
		return common.NewErrorf("ipLimitBanDurationSec must be between 0 and 2592000 (30 days); 0 = permanent block")
	}
	switch strings.ToLower(strings.TrimSpace(enforcement)) {
	case "", IPLimitEnforcementDrop, IPLimitEnforcementBlock, IPLimitEnforcementDropAndBlock:
	default:
		return common.NewErrorf("invalid ipLimitEnforcement: %s", enforcement)
	}
	switch strings.ToLower(strings.TrimSpace(excessPolicy)) {
	case "", IPLimitExcessPolicyNewest, IPLimitExcessPolicyOldest:
	default:
		return common.NewErrorf("invalid ipLimitExcessPolicy: %s", excessPolicy)
	}
	return nil
}
