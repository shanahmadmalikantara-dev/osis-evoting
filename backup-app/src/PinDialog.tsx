import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { inputClass } from "./Shell";
import { api, errorText } from "./store";

// Asks for the officer PIN; the Rust side checks it and locks after 5 wrong tries.
export function PinDialog({ open, onCancel, onOk }: { open: boolean; onCancel: () => void; onOk: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setPin("");
    setError(null);
    onCancel();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.verifyPin(pin);
      setPin("");
      onOk(pin);
    } catch (e) {
      setError(errorText(e));
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="pin-title">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <span className="rubber-stamp w-fit -rotate-3 px-2 py-0.5 text-xs">Khusus petugas</span>
        <h2 id="pin-title" className="font-display text-3xl font-black leading-tight">
          Masukkan PIN petugas
        </h2>
        <input
          aria-label="PIN petugas"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          className={`${inputClass} text-center text-3xl tracking-[0.5em]`}
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Batal
          </Button>
          <Button type="submit" disabled={busy || pin.length < 4}>
            {busy ? "Memeriksa..." : "Masuk"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
