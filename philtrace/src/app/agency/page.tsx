'use client';

import { useState } from 'react';

export default function AgencyPortalPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('dpwh-admin@philtrace.ph');
  const [password, setPassword] = useState('dpwh-demo-2026');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Update Form state
  const [projectId, setProjectId] = useState('');
  const [percentDone, setPercentDone] = useState(100);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/agency/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid email or password');
      const data = await res.json() as { agencyName?: string };
      setAgencyName(data.agencyName || 'Government Agency');
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      const res = await fetch('/api/agency-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          percentDone: Number(percentDone),
          note,
          photoUrl: photoUrl || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error || 'Failed to submit agency update');
      }
      setUpdateSuccess(true);
      setNote('');
      setProjectId('');
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Submission failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-gray-200 pb-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">🏛️ Government Agency Portal</h1>
        <p className="text-sm text-gray-500">
          Official DPWH & Implementing Agency Transparency Verification
        </p>
      </div>

      {!isLoggedIn ? (
        <form onSubmit={handleLogin} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Agency Sign-In</h2>
          {loginError && (
            <div className="rounded bg-red-50 p-3 text-xs text-red-800 border border-red-200">
              {loginError}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-700">Official Agency Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Sign In to Agency Portal
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Logged in as:</p>
              <h2 className="text-sm font-bold text-blue-900">{agencyName}</h2>
            </div>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="text-xs font-semibold text-gray-600 hover:text-red-600"
            >
              Sign Out
            </button>
          </div>

          <form onSubmit={handlePostUpdate} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900">Publish Official Progress Update</h3>
            {updateSuccess && (
              <div className="rounded bg-green-50 p-3 text-xs text-green-800 border border-green-200">
                ✓ Official agency progress update posted successfully!
              </div>
            )}
            {updateError && (
              <div className="rounded bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                {updateError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-700">Contract ID</label>
              <input
                type="text"
                required
                placeholder="e.g. 21NA0052"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Verified Percent Completion (0 - 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={percentDone}
                onChange={(e) => setPercentDone(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Official Note / Site Inspection Report</label>
              <textarea
                rows={3}
                required
                placeholder="Inspection conducted on-site..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Photo Proof URL (optional)</label>
              <input
                type="url"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Publish Official Government Update
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
