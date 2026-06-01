package job

import (
	"sync"
	"time"

	"github.com/konstpic/sharx-code/v2/logger"
	"github.com/konstpic/sharx-code/v2/web/service"
)

// GeofileAutoUpdateJobTickSchedule wakes the geofile auto-update job often; cadence uses panel settings.
const GeofileAutoUpdateJobTickSchedule = "@every 1h"

// GeofileAutoUpdateJob re-downloads and applies active geofile assets when their remote source changed.
type GeofileAutoUpdateJob struct {
	serverService service.ServerService
	runMu         sync.Mutex
	lastRun       int64
}

func NewGeofileAutoUpdateJob() *GeofileAutoUpdateJob {
	return &GeofileAutoUpdateJob{
		serverService: service.ServerService{},
	}
}

func (j *GeofileAutoUpdateJob) Run() {
	if !j.runMu.TryLock() {
		return
	}
	defer j.runMu.Unlock()

	settingService := service.SettingService{}
	enabled, err := settingService.GetGeofileAutoUpdateEnable()
	if err != nil || !enabled {
		return
	}

	intervalHours, err := settingService.GetGeofileAutoUpdateIntervalHours()
	if err != nil {
		intervalHours = 24
	}
	now := time.Now().Unix()
	if j.lastRun > 0 && now-j.lastRun < int64(intervalHours)*3600 {
		return
	}
	j.lastRun = now

	updated, err := j.serverService.AutoUpdateActiveGeofileAssets()
	if err != nil {
		logger.Warningf("GeofileAutoUpdateJob: %v", err)
		return
	}
	if updated > 0 {
		logger.Infof("GeofileAutoUpdateJob: updated and applied %d geofile asset(s)", updated)
	}
}
