// Type registry for modular sequence type rendering
// Each type can register its own rendering logic

const typeRenderers = new Map();

// Register a renderer for a specific type
export function registerTypeRenderer(typeName, renderer) {
  typeRenderers.set(typeName, renderer);
}

// Get renderer for a type
export function getTypeRenderer(typeName) {
  return typeRenderers.get(typeName);
}

// Fetch type schemas from backend
export async function fetchTypeSchemas() {
  const res = await fetch("/api/types");
  if (!res.ok) throw new Error("Failed to fetch type schemas");
  return await res.json();
}

// Default field renderers
const fieldRenderers = {
  tagselect: (field, value, statuses, onChange, allParams = {}) => {
    // Extract all unique tags from statuses
    const allTags = new Set();
    statuses.forEach((status) => {
      if (status.tags && Array.isArray(status.tags)) {
        status.tags.forEach((tag) => allTags.add(tag));
      }
    });
    
    const select = document.createElement("select");
    select.className = "type-field";
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- All Statuses (No Filter) --";
    select.appendChild(defaultOption);
    
    Array.from(allTags).sort().forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      if (value === tag) option.selected = true;
      select.appendChild(option);
    });
    
    select.addEventListener("change", (e) => {
      onChange(field.key, e.target.value || null);
    });
    
    return select;
  },

  select: (field, value, statuses, onChange, allParams = {}) => {
    const select = document.createElement("select");
    select.className = "type-field";
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = `-- Select ${field.label} --`;
    select.appendChild(defaultOption);
    
    // Filter statuses by tag if tagFilter is set
    let filteredStatuses = statuses;
    if (allParams.tagFilter) {
      filteredStatuses = statuses.filter((status) =>
        status.tags && status.tags.includes(allParams.tagFilter)
      );
    }
    
    filteredStatuses.forEach((status) => {
      const option = document.createElement("option");
      option.value = status.id;
      option.textContent = `${status.emoji} ${status.text.replace(/\n/g, " ")}`;
      if (value == status.id) option.selected = true;
      select.appendChild(option);
    });
    
    select.addEventListener("change", (e) => {
      onChange(field.key, parseInt(e.target.value));
    });
    
    return select;
  },

  multiselect: (field, value, statuses, onChange, allParams = {}) => {
    const container = document.createElement("div");
    container.className = "multiselect-container";
    
    // Display selected items
    const selectedList = document.createElement("div");
    selectedList.className = "selected-items";
    
    const updateSelectedList = (items) => {
      selectedList.innerHTML = "";
      items.forEach((item) => {
        const chip = document.createElement("div");
        chip.className = "selected-chip";
        
        if (field.options) {
          // For weekdays or other options
          const opt = field.options.find((o) => o.value === item);
          chip.textContent = opt ? opt.label : item;
        } else {
          // For status IDs
          const status = statuses.find((s) => s.id == item);
          chip.textContent = status
            ? `${status.emoji} ${status.text.replace(/\n/g, " ")}`
            : item;
        }
        
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.className = "remove-chip";
        removeBtn.onclick = () => {
          const newItems = items.filter((i) => i !== item);
          onChange(field.key, newItems);
          updateSelectedList(newItems);
        };
        
        chip.appendChild(removeBtn);
        selectedList.appendChild(chip);
      });
    };
    
    // Add selector
    const select = document.createElement("select");
    select.className = "type-field";
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = `-- Add ${field.label} --`;
    select.appendChild(defaultOption);
    
    // Filter statuses by tag if tagFilter is set
    let filteredStatuses = statuses;
    if (allParams.tagFilter && !field.options) {
      filteredStatuses = statuses.filter((status) =>
        status.tags && status.tags.includes(allParams.tagFilter)
      );
    }
    
    const options = field.options || filteredStatuses.map((s) => ({ value: s.id, label: `${s.emoji} ${s.text.replace(/\n/g, " ")}` }));
    
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    
    select.addEventListener("change", (e) => {
      if (e.target.value) {
        const currentValue = value || [];
        const newValue = field.options
          ? e.target.value
          : parseInt(e.target.value);
        
        if (!currentValue.includes(newValue)) {
          const newItems = [...currentValue, newValue];
          onChange(field.key, newItems);
          updateSelectedList(newItems);
        }
        
        e.target.value = "";
      }
    });
    
    updateSelectedList(value || []);
    container.appendChild(selectedList);
    container.appendChild(select);
    
    return container;
  },

  time: (field, value, statuses, onChange, allParams = {}) => {
    const input = document.createElement("input");
    input.type = "time";
    input.className = "type-field";
    input.value = value || "";
    input.addEventListener("change", (e) => {
      onChange(field.key, e.target.value);
    });
    return input;
  },

  text: (field, value, statuses, onChange, allParams = {}) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "type-field";
    input.value = value || "";
    input.addEventListener("change", (e) => {
      onChange(field.key, e.target.value);
    });
    return input;
  },

  number: (field, value, statuses, onChange, allParams = {}) => {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "type-field";
    input.value = value || "";
    input.addEventListener("change", (e) => {
      onChange(field.key, parseInt(e.target.value));
    });
    return input;
  },
};

// Generic renderer that uses schema
export function renderTypeFields(schema, params, statuses, onChange) {
  const container = document.createElement("div");
  container.className = "type-fields";
  
  const renderAllFields = (currentParams) => {
    container.innerHTML = "";
    
    schema.fields.forEach((field) => {
      const fieldGroup = document.createElement("div");
      fieldGroup.className = "field-group";
      
      const label = document.createElement("label");
      label.textContent = field.label;
      if (field.required) {
        label.classList.add("required");
      }
      fieldGroup.appendChild(label);
      
      const renderer = fieldRenderers[field.type];
      if (renderer) {
        const fieldElement = renderer(
          field,
          currentParams[field.key],
          statuses,
          (key, value) => {
            const newParams = { ...currentParams, [key]: value };
            onChange(newParams);
            // Re-render if tagFilter changed to update filtered status lists
            if (key === "tagFilter") {
              renderAllFields(newParams);
            }
          },
          currentParams // Pass all params for tag filtering
        );
        fieldGroup.appendChild(fieldElement);
      } else {
        const errorMsg = document.createElement("span");
        errorMsg.className = "error";
        errorMsg.textContent = `Unknown field type: ${field.type}`;
        fieldGroup.appendChild(errorMsg);
      }
      
      container.appendChild(fieldGroup);
    });
  };
  
  renderAllFields(params);
  return container;
}

// Built-in type renderers (can be overridden)
registerTypeRenderer("static", (item, statuses, onChange, schemas) => {
  const schema = schemas.find((s) => s.name === "static");
  return renderTypeFields(schema, item.params || {}, statuses, onChange);
});

registerTypeRenderer("random", (item, statuses, onChange, schemas) => {
  const schema = schemas.find((s) => s.name === "random");
  return renderTypeFields(schema, item.params || {}, statuses, onChange);
});

registerTypeRenderer("none", (item, statuses, onChange, schemas) => {
  const container = document.createElement("div");
  container.className = "type-fields";
  container.innerHTML = '<p class="type-note">No configuration needed - this clears the status.</p>';
  return container;
});

registerTypeRenderer("schedule", (item, statuses, onChange, schemas) => {
  const schema = schemas.find((s) => s.name === "schedule");
  return renderTypeFields(schema, item.params || {}, statuses, onChange);
});

registerTypeRenderer("weekday", (item, statuses, onChange, schemas) => {
  const schema = schemas.find((s) => s.name === "weekday");
  return renderTypeFields(schema, item.params || {}, statuses, (key, value) => {
    onChange({ ...item.params, [key]: value });
  });
});

registerTypeRenderer("conditional", (item, statuses, onChange, schemas) => {
  const schema = schemas.find((s) => s.name === "conditional");
  return renderTypeFields(schema, item.params || {}, statuses, (key, value) => {
    onChange({ ...item.params, [key]: value });
  });
});
