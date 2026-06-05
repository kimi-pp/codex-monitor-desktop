import { useEffect, useMemo, useRef } from "react";
import type { AgentActivity } from "../shared/types";
import { createOfficeRenderer } from "./office-renderer";

type OfficeSceneProps = {
  agents: AgentActivity[];
  selectedAgentId: string | undefined;
  onSelectAgent: (agentId: string) => void;
};

export function OfficeScene({ agents, selectedAgentId, onSelectAgent }: OfficeSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const agentsRef = useRef(agents);
  const selectedRef = useRef(selectedAgentId);
  const selectRef = useRef(onSelectAgent);
  const renderer = useMemo(() => createOfficeRenderer(), []);

  agentsRef.current = agents;
  selectedRef.current = selectedAgentId;
  selectRef.current = onSelectAgent;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let disposed = false;
    renderer
      .mount(host, {
        getAgents: () => agentsRef.current,
        getSelectedAgentId: () => selectedRef.current,
        onSelectAgent: (agentId) => selectRef.current(agentId)
      })
      .catch((error) => {
        if (!disposed) {
          console.error(error);
        }
      });

    return () => {
      disposed = true;
      renderer.destroy();
    };
  }, [renderer]);

  return <div className="office-scene" ref={hostRef} aria-label="Animated agent office" />;
}
