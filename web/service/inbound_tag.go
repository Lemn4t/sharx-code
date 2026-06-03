package service

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/konstpic/sharx-code/v2/database"
	"github.com/konstpic/sharx-code/v2/database/model"
	"github.com/konstpic/sharx-code/v2/util/common"
)

var inboundTagFormatRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$`)

func validateInboundTagFormat(tag string) error {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return common.NewError("Inbound tag is required")
	}
	if strings.EqualFold(tag, "api") {
		return common.NewError("Inbound tag \"api\" is reserved")
	}
	if !inboundTagFormatRe.MatchString(tag) {
		return common.NewError("Invalid inbound tag: use letters, digits, . _ : - (max 64 chars, must start with letter or digit)")
	}
	return nil
}

// ValidateInboundTag checks Xray inbound tag format and DB uniqueness.
func (s *InboundService) ValidateInboundTag(tag string, ignoreInboundId int) error {
	if err := validateInboundTagFormat(tag); err != nil {
		return err
	}
	tag = strings.TrimSpace(tag)
	exist, err := s.checkInboundTagExist(tag, ignoreInboundId)
	if err != nil {
		return err
	}
	if exist {
		return common.NewError("Inbound tag already exists:", tag)
	}
	return nil
}

func (s *InboundService) checkInboundTagExist(tag string, ignoreInboundId int) (bool, error) {
	dbConn := database.GetDB()
	if dbConn == nil {
		return false, nil
	}
	db := dbConn.Model(model.Inbound{}).Where("tag = ?", tag)
	if ignoreInboundId > 0 {
		db = db.Where("id != ?", ignoreInboundId)
	}
	var count int64
	if err := db.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// AssignInboundTag sets inbound.Tag from the user value or auto-generates when empty.
// Returns whether the tag was explicitly provided by the user (non-empty before trim).
func (s *InboundService) AssignInboundTag(inbound *model.Inbound, multiMode bool) (userProvided bool, err error) {
	if inbound == nil {
		return false, common.NewError("inbound is nil")
	}
	userProvided = strings.TrimSpace(inbound.Tag) != ""
	if userProvided {
		if err := s.ValidateInboundTag(inbound.Tag, inbound.Id); err != nil {
			return true, err
		}
		inbound.Tag = strings.TrimSpace(inbound.Tag)
		return true, nil
	}
	inbound.Tag = s.generateInboundTag(inbound, multiMode)
	return false, nil
}

// FinalizeInboundTagAfterCreate sets inbound-{id} in multi-node mode when tag was auto-generated.
func (s *InboundService) FinalizeInboundTagAfterCreate(inbound *model.Inbound, multiMode bool, userProvided bool) error {
	if inbound == nil || !multiMode || inbound.Id <= 0 || userProvided {
		return nil
	}
	newTag := fmt.Sprintf("inbound-%d", inbound.Id)
	if inbound.Tag == newTag {
		return nil
	}
	if err := s.ValidateInboundTag(newTag, inbound.Id); err != nil {
		return err
	}
	inbound.Tag = newTag
	return database.GetDB().Model(inbound).Update("tag", newTag).Error
}
