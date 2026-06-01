package service

import (
	"github.com/konstpic/sharx-code/v2/util/common"
)

func clampGeofileAutoUpdateHours(n int) int {
	if n < 1 {
		return 1
	}
	if n > 168 {
		return 168
	}
	return n
}

func (s *SettingService) GetGeofileAutoUpdateEnable() (bool, error) {
	v, err := s.getBool("geofileAutoUpdateEnable")
	if err != nil {
		return false, err
	}
	return v, nil
}

func (s *SettingService) GetGeofileAutoUpdateIntervalHours() (int, error) {
	n, err := s.getInt("geofileAutoUpdateIntervalHours")
	if err != nil {
		return 24, err
	}
	return clampGeofileAutoUpdateHours(n), nil
}

func ValidateGeofileAutoUpdateIntervalHours(hours int) error {
	if hours < 1 || hours > 168 {
		return common.NewErrorf("geofileAutoUpdateIntervalHours must be between 1 and 168")
	}
	return nil
}
