package src

import (
	"math/rand"
	"time"
)

// SequenceType defines the interface that all sequence types must implement
type SequenceType interface {
	// GetName returns the unique identifier for this type
	GetName() string

	// ShouldExecute determines if this sequence should run based on its conditions
	ShouldExecute(params map[string]interface{}, settings Settings) bool

	// SelectStatus returns the status ID(s) to use, or nil if no status
	SelectStatus(params map[string]interface{}, statuses []Status) *int

	// GetConfigSchema returns JSON schema for frontend configuration
	GetConfigSchema() TypeSchema
}

// TypeSchema defines what the frontend needs to render configuration UI
type TypeSchema struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Fields      []FieldSchema `json:"fields"`
}

// FieldSchema defines a single configuration field
type FieldSchema struct {
	Key          string   `json:"key"`
	Label        string   `json:"label"`
	Type         string   `json:"type"` // "text", "number", "select", "multiselect", "time", "weekday"
	Required     bool     `json:"required"`
	DefaultValue interface{} `json:"defaultValue,omitempty"`
	Options      []Option `json:"options,omitempty"` // For select/multiselect
}

// Option for select fields
type Option struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// SequenceTypeRegistry holds all available sequence types
var sequenceTypeRegistry = make(map[string]SequenceType)

// RegisterSequenceType adds a new type to the registry
func RegisterSequenceType(st SequenceType) {
	sequenceTypeRegistry[st.GetName()] = st
}

// GetSequenceType retrieves a type from the registry
func GetSequenceType(name string) SequenceType {
	return sequenceTypeRegistry[name]
}

// GetAllSequenceTypes returns all registered types
func GetAllSequenceTypes() map[string]SequenceType {
	return sequenceTypeRegistry
}

// GetAllTypeSchemas returns schemas for all registered types (for frontend)
func GetAllTypeSchemas() []TypeSchema {
	schemas := make([]TypeSchema, 0, len(sequenceTypeRegistry))
	for _, st := range sequenceTypeRegistry {
		schemas = append(schemas, st.GetConfigSchema())
	}
	return schemas
}

// =====================================================
// Built-in Sequence Types
// =====================================================

// StaticSequenceType - Always shows a specific status
type StaticSequenceType struct{}

func (t *StaticSequenceType) GetName() string {
	return "static"
}

func (t *StaticSequenceType) ShouldExecute(params map[string]interface{}, settings Settings) bool {
	return true // Always execute
}

func (t *StaticSequenceType) SelectStatus(params map[string]interface{}, statuses []Status) *int {
	if statusId, ok := params["statusId"].(float64); ok {
		id := int(statusId)
		return &id
	}
	return nil
}

func (t *StaticSequenceType) GetConfigSchema() TypeSchema {
	return TypeSchema{
		Name:        "static",
		Description: "Display a single status",
		Fields: []FieldSchema{
			{
				Key:      "tagFilter",
				Label:    "Filter by Tag (optional)",
				Type:     "tagselect",
				Required: false,
			},
			{
				Key:      "statusId",
				Label:    "Status",
				Type:     "select",
				Required: true,
			},
		},
	}
}

// RandomSequenceType - Randomly picks from a list of statuses
type RandomSequenceType struct{}

func (t *RandomSequenceType) GetName() string {
	return "random"
}

func (t *RandomSequenceType) ShouldExecute(params map[string]interface{}, settings Settings) bool {
	return true // Always execute
}

func (t *RandomSequenceType) SelectStatus(params map[string]interface{}, statuses []Status) *int {
	if statusIdsRaw, ok := params["statusIds"].([]interface{}); ok && len(statusIdsRaw) > 0 {
		// Convert to int slice
		statusIds := make([]int, 0, len(statusIdsRaw))
		for _, raw := range statusIdsRaw {
			if id, ok := raw.(float64); ok {
				statusIds = append(statusIds, int(id))
			}
		}
		
		if len(statusIds) > 0 {
			selected := statusIds[rand.Intn(len(statusIds))]
			return &selected
		}
	}
	return nil
}

func (t *RandomSequenceType) GetConfigSchema() TypeSchema {
	return TypeSchema{
		Name:        "random",
		Description: "Randomly select from multiple statuses",
		Fields: []FieldSchema{
			{
				Key:      "tagFilter",
				Label:    "Filter by Tag (optional)",
				Type:     "tagselect",
				Required: false,
			},
			{
				Key:      "statusIds",
				Label:    "Statuses",
				Type:     "multiselect",
				Required: true,
			},
		},
	}
}

// NoneSequenceType - Clears the status
type NoneSequenceType struct{}

func (t *NoneSequenceType) GetName() string {
	return "none"
}

func (t *NoneSequenceType) ShouldExecute(params map[string]interface{}, settings Settings) bool {
	return true // Always execute
}

func (t *NoneSequenceType) SelectStatus(params map[string]interface{}, statuses []Status) *int {
	return nil // No status = clear
}

func (t *NoneSequenceType) GetConfigSchema() TypeSchema {
	return TypeSchema{
		Name:        "none",
		Description: "Clear status (no emoji or text)",
		Fields:      []FieldSchema{}, // No configuration needed
	}
}

// ScheduleSequenceType - Only executes during specific time ranges
type ScheduleSequenceType struct{}

func (t *ScheduleSequenceType) GetName() string {
	return "schedule"
}

func (t *ScheduleSequenceType) ShouldExecute(params map[string]interface{}, settings Settings) bool {
	// Load timezone from settings
	timezone := settings.Timezone
	if timezone == "" {
		timezone = "UTC"
	}
	
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.Local
	}
	
	now := time.Now().In(loc)
	
	// Check weekday condition if specified
	if daysRaw, ok := params["weekdays"].([]interface{}); ok && len(daysRaw) > 0 {
		days := make([]string, 0, len(daysRaw))
		for _, raw := range daysRaw {
			if day, ok := raw.(string); ok {
				days = append(days, day)
			}
		}
		
		currentDay := now.Weekday().String()
		dayMatches := false
		for _, day := range days {
			if day == currentDay {
				dayMatches = true
				break
			}
		}
		
		if !dayMatches {
			return false
		}
	}
	
	// Check time range if specified
	startTime, hasStart := params["startTime"].(string)
	endTime, hasEnd := params["endTime"].(string)
	
	if hasStart && hasEnd && startTime != "" && endTime != "" {
		currentTime := now.Format("15:04")
		return currentTime >= startTime && currentTime <= endTime
	}
	
	// If no time specified but weekday matched (or no weekday specified), return true
	return true
}

func (t *ScheduleSequenceType) SelectStatus(params map[string]interface{}, statuses []Status) *int {
	if statusId, ok := params["statusId"].(float64); ok {
		id := int(statusId)
		return &id
	}
	return nil
}

func (t *ScheduleSequenceType) GetConfigSchema() TypeSchema {
	return TypeSchema{
		Name:        "schedule",
		Description: "Display status during specific times and days",
		Fields: []FieldSchema{
			{
				Key:      "tagFilter",
				Label:    "Filter by Tag (optional)",
				Type:     "tagselect",
				Required: false,
			},
			{
				Key:      "statusId",
				Label:    "Status",
				Type:     "select",
				Required: true,
			},
			{
				Key:      "weekdays",
				Label:    "Days of Week (optional)",
				Type:     "multiselect",
				Required: false,
				Options: []Option{
					{Value: "Monday", Label: "Monday"},
					{Value: "Tuesday", Label: "Tuesday"},
					{Value: "Wednesday", Label: "Wednesday"},
					{Value: "Thursday", Label: "Thursday"},
					{Value: "Friday", Label: "Friday"},
					{Value: "Saturday", Label: "Saturday"},
					{Value: "Sunday", Label: "Sunday"},
				},
			},
			{
				Key:      "startTime",
				Label:    "Start Time (HH:MM, optional)",
				Type:     "time",
				Required: false,
			},
			{
				Key:      "endTime",
				Label:    "End Time (HH:MM, optional)",
				Type:     "time",
				Required: false,
			},
		},
	}
}

// init registers all built-in types
func init() {
	RegisterSequenceType(&StaticSequenceType{})
	RegisterSequenceType(&RandomSequenceType{})
	RegisterSequenceType(&NoneSequenceType{})
	RegisterSequenceType(&ScheduleSequenceType{})
}
