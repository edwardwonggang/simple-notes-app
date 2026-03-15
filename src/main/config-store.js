const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'ai-client-config.json';

const DEFAULT_CONFIG = Object.freeze({
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: '',
  model: '',
  modelOptions: [],
  proxyUrl: '',
  ignoreTlsErrors: false,
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 16384
});

function getConfigPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function normalizeConfig(input = {}) {
  const modelOptions = normalizeModelOptions(input.modelOptions ?? input.models ?? []);
  let model = String(input.model ?? DEFAULT_CONFIG.model).trim();

  if (!model && modelOptions.length) {
    model = modelOptions[0];
  } else if (model && !modelOptions.includes(model)) {
    modelOptions.unshift(model);
  }

  return {
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    apiUrl: String(input.apiUrl ?? DEFAULT_CONFIG.apiUrl).trim(),
    apiKey: String(input.apiKey ?? DEFAULT_CONFIG.apiKey).trim(),
    model,
    modelOptions,
    proxyUrl: String(input.proxyUrl ?? DEFAULT_CONFIG.proxyUrl).trim(),
    ignoreTlsErrors: Boolean(input.ignoreTlsErrors),
    systemPrompt: String(input.systemPrompt ?? DEFAULT_CONFIG.systemPrompt),
    temperature: normalizeTemperature(input.temperature),
    maxTokens: normalizeMaxTokens(input.maxTokens)
  };
}

function normalizeConfigStore(input = {}) {
  if (looksLikeLegacyConfig(input)) {
    const migrated = normalizeProfile(
      {
        ...input,
        id: 'profile-default',
        name: '默认配置'
      },
      0
    );

    return {
      activeProfileId: migrated.id,
      profiles: [migrated]
    };
  }

  const rawProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  const profiles = rawProfiles.length
    ? mergeProfilesByProvider(rawProfiles.map((profile, index) => normalizeProfile(profile, index)))
    : [normalizeProfile({}, 0)];

  const activeProfile = profiles.find((profile) => (
    profile.id === input.activeProfileId ||
    (Array.isArray(profile.mergedProfileIds) && profile.mergedProfileIds.includes(input.activeProfileId))
  ));

  const activeProfileId = activeProfile?.id || profiles[0].id;

  return {
    activeProfileId,
    profiles
  };
}

function normalizeProfile(input = {}, index = 0) {
  const normalized = normalizeConfig(input);
  return {
    ...normalized,
    id: normalized.id || createProfileId(index),
    name: normalized.name || `配置 ${index + 1}`
  };
}

function normalizeModelOptions(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,]/)
        .map((item) => item.trim());

  const seen = new Set();
  const result = [];

  source.forEach((item) => {
    const model = String(item || '').trim();
    if (!model || seen.has(model)) {
      return;
    }
    seen.add(model);
    result.push(model);
  });

  return result;
}

function normalizeTemperature(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_CONFIG.temperature;
  }
  return Math.max(0, Math.min(2, numeric));
}

function normalizeMaxTokens(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_CONFIG.maxTokens;
  }
  return Math.max(256, Math.min(65536, Math.round(numeric)));
}

function createProfileId(index) {
  return `profile-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeProfilesByProvider(profiles) {
  const merged = [];
  const groupIndexByKey = new Map();

  profiles.forEach((profile, index) => {
    const key = buildProviderKey(profile);
    const existingIndex = groupIndexByKey.get(key);

    if (existingIndex === undefined) {
      const normalized = normalizeProfile(profile, index);
      normalized.mergedProfileIds = [normalized.id];
      merged.push(normalized);
      groupIndexByKey.set(key, merged.length - 1);
      return;
    }

    const current = merged[existingIndex];
    const modelOptions = normalizeModelOptions([
      ...(current.modelOptions || []),
      current.model,
      ...(profile.modelOptions || []),
      profile.model
    ]);

    const nextModel = current.model || profile.model || modelOptions[0] || '';

    merged[existingIndex] = {
      ...current,
      name: preferProviderName(current.name, profile.name),
      apiUrl: current.apiUrl || profile.apiUrl,
      apiKey: current.apiKey || profile.apiKey,
      model: nextModel,
      modelOptions,
      proxyUrl: current.proxyUrl || profile.proxyUrl,
      ignoreTlsErrors: current.ignoreTlsErrors || profile.ignoreTlsErrors,
      systemPrompt: current.systemPrompt || profile.systemPrompt,
      temperature: Number.isFinite(current.temperature) ? current.temperature : profile.temperature,
      maxTokens: Number.isFinite(current.maxTokens) ? current.maxTokens : profile.maxTokens,
      mergedProfileIds: Array.from(new Set([...(current.mergedProfileIds || [current.id]), profile.id]))
    };
  });

  return merged;
}

function buildProviderKey(profile = {}) {
  return [
    normalizeProviderUrl(profile.apiUrl),
    normalizeProviderToken(profile.apiKey),
    String(profile.proxyUrl || '').trim(),
    profile.ignoreTlsErrors ? 'tls-off' : 'tls-on'
  ].join('||');
}

function normalizeProviderUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function normalizeProviderToken(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)[0] || '';
}

function preferProviderName(currentName, nextName) {
  const current = String(currentName || '').trim();
  const next = String(nextName || '').trim();
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  return current.length >= next.length ? current : next;
}

function looksLikeLegacyConfig(input) {
  return Boolean(input) && !Array.isArray(input) && !Array.isArray(input.profiles) && (
    'apiUrl' in input ||
    'apiKey' in input ||
    'model' in input ||
    'proxyUrl' in input ||
    'systemPrompt' in input
  );
}

function loadConfig(app) {
  const configPath = getConfigPath(app);

  try {
    if (!fs.existsSync(configPath)) {
      const configStore = normalizeConfigStore();
      return {
        configStore,
        activeProfile: configStore.profiles[0],
        configPath
      };
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const configStore = normalizeConfigStore(parsed);
    return {
      configStore,
      activeProfile: getActiveProfile(configStore),
      configPath
    };
  } catch (_error) {
    const configStore = normalizeConfigStore();
    return {
      configStore,
      activeProfile: configStore.profiles[0],
      configPath
    };
  }
}

function saveConfig(app, nextConfigStore) {
  const configPath = getConfigPath(app);
  const configStore = normalizeConfigStore(nextConfigStore);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(configStore, null, 2), 'utf8');

  return {
    configStore,
    activeProfile: getActiveProfile(configStore),
    configPath
  };
}

function getActiveProfile(configStore) {
  return configStore.profiles.find((profile) => profile.id === configStore.activeProfileId) || configStore.profiles[0];
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  normalizeConfig,
  normalizeConfigStore
};
