import type { SystemDesignEdge, SystemDesignNode } from '../types';

export type BrainstormLens = 'balanced' | 'traffic' | 'failure' | 'security';

export interface CanvasBrainstormSuggestion {
  componentType: string;
  title: string;
  rationale: string;
  category: 'Foundation' | 'Scale' | 'Resilience' | 'Security' | 'Data';
  impact: 'High' | 'Medium';
}

export interface CanvasBrainstormResult {
  score: number;
  summary: string;
  suggestions: CanvasBrainstormSuggestion[];
}

const ENTRY = new Set(['client', 'mobile_app']);
const INGRESS = new Set(['dns', 'cdn', 'load_balancer', 'api_gateway']);
const COMPUTE = new Set(['web_server', 'microservice', 'monolith', 'container', 'worker']);
const DATA = new Set(['sql_database', 'nosql_database', 'object_storage', 'search_index']);
const SCALE = new Set(['cdn', 'load_balancer', 'rate_limiter', 'cache']);
const SECURITY = new Set(['firewall', 'auth_service', 'rate_limiter']);

const hasAny = (types: Set<string>, candidates: Set<string>) =>
  [...candidates].some(candidate => types.has(candidate));

export const analyzeSystemDesign = (
  nodes: SystemDesignNode[],
  edges: SystemDesignEdge[],
  lens: BrainstormLens = 'balanced',
  scenarioTitle = '',
): CanvasBrainstormResult => {
  const types = new Set(nodes.map(node => node.componentType));
  const connectedNodes = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  const checks = [
    hasAny(types, ENTRY),
    hasAny(types, INGRESS),
    hasAny(types, COMPUTE),
    hasAny(types, DATA),
    hasAny(types, SCALE) || hasAny(types, SECURITY),
    nodes.length > 0 && (nodes.length === 1 || connectedNodes.size >= Math.min(nodes.length, 3)),
  ];
  const score = nodes.length ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : 0;
  const suggestions: CanvasBrainstormSuggestion[] = [];
  const seen = new Set<string>();

  const suggest = (suggestion: CanvasBrainstormSuggestion) => {
    if (types.has(suggestion.componentType) || seen.has(suggestion.componentType)) return;
    seen.add(suggestion.componentType);
    suggestions.push(suggestion);
  };

  if (!hasAny(types, ENTRY)) suggest({
    componentType: 'client',
    title: 'Define the entry point',
    rationale: 'Make the user-to-system boundary explicit before refining downstream services.',
    category: 'Foundation',
    impact: 'High',
  });
  if (!hasAny(types, INGRESS)) suggest({
    componentType: 'api_gateway',
    title: 'Create an ingress boundary',
    rationale: 'Centralize routing, policy enforcement, and request shaping at the edge.',
    category: 'Foundation',
    impact: 'High',
  });
  if (!hasAny(types, COMPUTE)) suggest({
    componentType: 'microservice',
    title: 'Add a compute layer',
    rationale: 'Represent the service that owns business logic and coordinates data access.',
    category: 'Foundation',
    impact: 'High',
  });
  if (!hasAny(types, DATA)) suggest({
    componentType: 'sql_database',
    title: 'Choose a source of truth',
    rationale: 'Anchor consistency, ownership, and persistence decisions in a primary store.',
    category: 'Data',
    impact: 'High',
  });

  const scenario = scenarioTitle.toLowerCase().slice(0, 300);
  const addTrafficIdeas = () => {
    suggest({ componentType: 'rate_limiter', title: 'Protect the request budget', rationale: 'Bound abusive and burst traffic before it consumes application capacity.', category: 'Scale', impact: 'High' });
    suggest({ componentType: 'cache', title: 'Shorten the hot path', rationale: 'Absorb repeated reads and reduce pressure on the source of truth.', category: 'Scale', impact: 'High' });
    suggest({ componentType: 'load_balancer', title: 'Distribute peak traffic', rationale: 'Remove the single-instance bottleneck and spread requests across healthy capacity.', category: 'Scale', impact: 'High' });
    suggest({ componentType: 'cdn', title: 'Move delivery to the edge', rationale: 'Serve cacheable content closer to users and reduce origin traffic.', category: 'Scale', impact: 'Medium' });
  };
  const addFailureIdeas = () => {
    suggest({ componentType: 'message_queue', title: 'Buffer partial failure', rationale: 'Decouple producers from slow consumers and create a recoverable work backlog.', category: 'Resilience', impact: 'High' });
    suggest({ componentType: 'load_balancer', title: 'Route around unhealthy capacity', rationale: 'Keep the request path available when an instance fails.', category: 'Resilience', impact: 'High' });
    suggest({ componentType: 'pub_sub', title: 'Fan out without tight coupling', rationale: 'Let independent consumers recover and scale without blocking publishers.', category: 'Resilience', impact: 'Medium' });
    suggest({ componentType: 'object_storage', title: 'Add durable blob storage', rationale: 'Keep large immutable payloads outside ephemeral compute and database rows.', category: 'Data', impact: 'Medium' });
  };
  const addSecurityIdeas = () => {
    suggest({ componentType: 'auth_service', title: 'Separate identity decisions', rationale: 'Make authentication and authorization an explicit trust boundary.', category: 'Security', impact: 'High' });
    suggest({ componentType: 'firewall', title: 'Reduce exposed surface area', rationale: 'Filter traffic before it reaches private services and data stores.', category: 'Security', impact: 'High' });
    suggest({ componentType: 'rate_limiter', title: 'Limit automated abuse', rationale: 'Apply quotas at the edge to contain credential and resource attacks.', category: 'Security', impact: 'High' });
  };

  if (lens === 'traffic') addTrafficIdeas();
  if (lens === 'failure') addFailureIdeas();
  if (lens === 'security') addSecurityIdeas();
  if (lens === 'balanced') {
    if (hasAny(types, DATA)) suggest({ componentType: 'cache', title: 'Protect the primary store', rationale: 'Keep repeated reads off the critical persistence path.', category: 'Scale', impact: 'Medium' });
    if (hasAny(types, COMPUTE)) suggest({ componentType: 'auth_service', title: 'Clarify the trust boundary', rationale: 'Show where identity and access decisions are enforced.', category: 'Security', impact: 'High' });
    if (hasAny(types, COMPUTE)) suggest({ componentType: 'load_balancer', title: 'Remove single-instance risk', rationale: 'Distribute requests across independently replaceable compute.', category: 'Resilience', impact: 'High' });
    if (types.has('worker')) suggest({ componentType: 'message_queue', title: 'Feed background work safely', rationale: 'Buffer jobs and isolate request latency from worker throughput.', category: 'Resilience', impact: 'High' });
    if (/rate|traffic|api|scale|shorten/.test(scenario)) addTrafficIdeas();
    if (/media|video|photo|image|file|upload/.test(scenario)) {
      suggest({ componentType: 'object_storage', title: 'Separate binary payloads', rationale: 'Store large objects outside transactional rows and serve them independently.', category: 'Data', impact: 'High' });
      suggest({ componentType: 'cdn', title: 'Deliver media from the edge', rationale: 'Reduce origin load and latency for globally requested assets.', category: 'Scale', impact: 'Medium' });
    }
    if (/search|catalog|discovery/.test(scenario)) suggest({ componentType: 'search_index', title: 'Add a retrieval index', rationale: 'Separate relevance-heavy queries from transactional persistence.', category: 'Data', impact: 'High' });
    if (/chat|notification|feed|event|stream/.test(scenario)) suggest({ componentType: 'pub_sub', title: 'Model event fan-out', rationale: 'Broadcast state changes without coupling every consumer to the request path.', category: 'Resilience', impact: 'High' });
  }

  const summary = score >= 84
    ? 'Strong coverage. Pressure-test the trade-offs.'
    : score >= 50
      ? 'Core path visible. Important boundaries remain.'
      : 'Shape the critical request path first.';

  return { score, summary, suggestions: suggestions.slice(0, 5) };
};