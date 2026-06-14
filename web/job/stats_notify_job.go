package job

import (
	"github.com/konstpic/sharx-code/v2/web/service"
)

// LoginStatus represents the status of a login attempt.
type LoginStatus byte

const (
	LoginSuccess LoginStatus = 1 // Successful login
	LoginFail    LoginStatus = 0 // Failed login attempt
)

// StatsNotifyJob sends the periodic DB backup to Telegram admins.
// It checks tgBotEnable and tgBotBackup at run time so the job does not need
// to be re-registered when the operator saves settings after panel startup.
// Backup does not require Xray to be running.
type StatsNotifyJob struct {
	tgbotService   service.Tgbot
	settingService service.SettingService
}

// NewStatsNotifyJob creates a new statistics notification job instance.
func NewStatsNotifyJob() *StatsNotifyJob {
	return new(StatsNotifyJob)
}

// Run sends the DB backup via Telegram bot when both tgBotEnable and
// tgBotBackup are enabled in settings. Xray state is not checked because
// a database backup is independent of the proxy core.
func (j *StatsNotifyJob) Run() {
	enabled, err := j.settingService.GetTgbotEnabled()
	if err != nil || !enabled {
		return
	}
	j.tgbotService.SendReport()
}
