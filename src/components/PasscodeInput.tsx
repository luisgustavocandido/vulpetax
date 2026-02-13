"use client";

import { useState } from "react";

export function PasscodeInput() {
  const [show, setShow] = useState(false);

  return (
    <div className="mt-1 flex items-center gap-1 rounded-md border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
      <input
        id="passcode"
        name="passcode"
        type={show ? "text" : "password"}
        autoComplete="off"
        required
        className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-0"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="shrink-0 rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        title={show ? "Ocultar passcode" : "Ver passcode"}
        tabIndex={-1}
      >
        {show ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}
