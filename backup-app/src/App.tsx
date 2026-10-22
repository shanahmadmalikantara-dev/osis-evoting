import { useCallback, useEffect, useState } from "react";
import { Booth } from "./Booth";
import { Officer } from "./Officer";
import { PinDialog } from "./PinDialog";
import { Report } from "./Report";
import { Setup } from "./Setup";
import { Shell } from "./Shell";
import { api, errorText, type PublicState } from "./store";

type View = { name: "booth" } | { name: "officer"; pin: string } | { name: "report"; pin: string };

export function App() {
  const [state, setState] = useState<PublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "booth" });
  const [askPin, setAskPin] = useState(false);

  const reload = useCallback(async () => {
    try {
      setState(await api.getState());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) {
    return (
      <Shell>
        <p className="m-auto font-type text-xl">{error}</p>
      </Shell>
    );
  }
  if (!state) return <Shell>{null}</Shell>;
  if (!state.configured) {
    return (
      <Shell>
        <Setup onDone={reload} />
      </Shell>
    );
  }

  return (
    <Shell>
      {view.name === "booth" ? <Booth state={state} onOfficer={() => setAskPin(true)} /> : null}
      {view.name === "officer" ? (
        <Officer
          pin={view.pin}
          state={state}
          onChanged={reload}
          onBack={() => setView({ name: "booth" })}
          onReport={() => setView({ name: "report", pin: view.pin })}
        />
      ) : null}
      {view.name === "report" ? <Report pin={view.pin} onBack={() => setView({ name: "officer", pin: view.pin })} /> : null}
      <PinDialog
        open={askPin}
        onCancel={() => setAskPin(false)}
        onOk={(pin) => {
          setAskPin(false);
          setView({ name: "officer", pin });
        }}
      />
    </Shell>
  );
}
