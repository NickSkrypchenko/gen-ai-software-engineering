export interface AgentSpec {
  name:                string;
  model:               string;
  max_tokens:          number;
  tools:               string[];
  skills:              string[];
  role:                string;
  inputs:              string[];
  outputs:             string[];
  model_justification: string;
  prompt:              string;
}

export interface RunCtx {
  bugId:   string;
  agents:  Map<string, AgentSpec>;
  skills:  Map<string, string>;
  bugDir:  string;
}

export interface RunResult {
  summary: {
    bugId:       string;
    stagesRun:   number;
    failures:    string[];
    durationMs?: number;
  };
  failures: string[];
}
