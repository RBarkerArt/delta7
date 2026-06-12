import React, { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  DEFAULT_BREAK_ROOM_CONFIG,
  normalizeBreakRoomConfig,
  type BreakRoomConfig,
  type BreakRoomFridgeItem,
  type BreakRoomUpdate,
  type BreakRoomUpdateType,
} from '../lib/breakRoom';

const UPDATE_TYPES: BreakRoomUpdateType[] = ['project', 'lore', 'mixed'];

const sortUpdates = (updates: BreakRoomUpdate[]) => (
  [...updates].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  })
);

const toConfigWrite = (config: BreakRoomConfig) => ({
  unitLabel: config.unitLabel.trim() || DEFAULT_BREAK_ROOM_CONFIG.unitLabel,
  coffeeValue: Math.max(0, Math.round(config.coffeeValue || 0)),
  fridgeOutOfOrderMessage: config.fridgeOutOfOrderMessage.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeOutOfOrderMessage,
  fridgeCorrectMessage: config.fridgeCorrectMessage.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeCorrectMessage,
  fridgeWrongMessage: config.fridgeWrongMessage.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeWrongMessage,
  fridgeItems: config.fridgeItems.map((item, index) => ({
    slot: index + 1,
    name: item.name.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeItems[index].name,
    milligramValue: Math.max(0, Math.round(item.milligramValue || 0)),
    snarkyMessage: item.snarkyMessage.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeItems[index].snarkyMessage,
    correctMessage: item.correctMessage.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeItems[index].correctMessage,
  })),
  updatedAt: Timestamp.now(),
});

const emptyUpdate = (): BreakRoomUpdate => ({
  title: '',
  body: '',
  type: 'project',
  published: false,
  pinned: false,
});

export const AdminBreakRoom: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<BreakRoomConfig>(DEFAULT_BREAK_ROOM_CONFIG);
  const [updates, setUpdates] = useState<BreakRoomUpdate[]>([]);
  const [editingUpdate, setEditingUpdate] = useState<BreakRoomUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeConfig = onSnapshot(doc(db, 'break_room_config', 'main'), (snapshot) => {
      setConfig(normalizeBreakRoomConfig(snapshot.exists() ? snapshot.data() : null));
      setLoading(false);
    }, (err) => {
      setError((err as Error).message);
      setLoading(false);
    });

    const unsubscribeUpdates = onSnapshot(collection(db, 'break_room_updates'), (snapshot) => {
      const nextUpdates = snapshot.docs.map(updateDoc => ({
        id: updateDoc.id,
        ...updateDoc.data(),
      })) as BreakRoomUpdate[];

      setUpdates(sortUpdates(nextUpdates));
    }, (err) => {
      setError((err as Error).message);
    });

    return () => {
      unsubscribeConfig();
      unsubscribeUpdates();
    };
  }, []);

  const updateConfigField = <K extends keyof BreakRoomConfig>(key: K, value: BreakRoomConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateFridgeItem = (slot: number, patch: Partial<BreakRoomFridgeItem>) => {
    setConfig(prev => ({
      ...prev,
      fridgeItems: prev.fridgeItems.map(item => (
        item.slot === slot ? { ...item, ...patch } : item
      )),
    }));
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    setError(null);

    try {
      const normalized = normalizeBreakRoomConfig(config);
      const writeConfig = toConfigWrite(normalized);
      await setDoc(doc(db, 'break_room_config', 'main'), writeConfig, { merge: true });
      await addDoc(collection(db, 'admin_events'), {
        action: 'break_room_config_update',
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      setConfig(normalizeBreakRoomConfig(writeConfig));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const saveUpdate = async () => {
    if (!editingUpdate) return;

    const title = editingUpdate.title.trim();
    const body = editingUpdate.body.trim();

    if (!title || !body) {
      setError('Bulletin updates need a title and body.');
      return;
    }

    setIsSavingUpdate(true);
    setError(null);

    try {
      const payload = {
        title,
        body,
        type: editingUpdate.type,
        published: editingUpdate.published,
        pinned: editingUpdate.pinned,
        updatedAt: Timestamp.now(),
      };

      if (editingUpdate.id) {
        await updateDoc(doc(db, 'break_room_updates', editingUpdate.id), payload);
        await addDoc(collection(db, 'admin_events'), {
          action: 'break_room_update_edit',
          updateId: editingUpdate.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      } else {
        const createdRef = await addDoc(collection(db, 'break_room_updates'), {
          ...payload,
          createdAt: Timestamp.now(),
        });
        await addDoc(collection(db, 'admin_events'), {
          action: 'break_room_update_create',
          updateId: createdRef.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      }

      setEditingUpdate(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSavingUpdate(false);
    }
  };

  const deleteUpdate = async (update: BreakRoomUpdate) => {
    if (!update.id || !window.confirm(`Delete "${update.title}" from the bulletin board?`)) return;

    try {
      await deleteDoc(doc(db, 'break_room_updates', update.id));
      await addDoc(collection(db, 'admin_events'), {
        action: 'break_room_update_delete',
        updateId: update.id,
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      if (editingUpdate?.id === update.id) setEditingUpdate(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        <Loader2 className="mr-2 animate-spin" size={16} />
        Loading Break Room controls...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Break Room</h1>
          <p className="text-sm text-gray-500">Manage Milligrams, refrigerator items, and public bulletin notes.</p>
        </div>
        <button
          type="button"
          onClick={saveConfig}
          disabled={isSavingConfig}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSavingConfig ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save Config
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Measurement Label</span>
            <input
              value={config.unitLabel}
              onChange={(event) => updateConfigField('unitLabel', event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coffee Value</span>
            <input
              type="number"
              min={0}
              value={config.coffeeValue}
              onChange={(event) => updateConfigField('coffeeValue', parseInt(event.target.value, 10) || 0)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Refrigerator Out-of-Order Message</span>
            <textarea
              value={config.fridgeOutOfOrderMessage}
              onChange={(event) => updateConfigField('fridgeOutOfOrderMessage', event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fallback Correct Message</span>
              <textarea
                value={config.fridgeCorrectMessage}
                onChange={(event) => updateConfigField('fridgeCorrectMessage', event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fallback Wrong Message</span>
              <textarea
                value={config.fridgeWrongMessage}
                onChange={(event) => updateConfigField('fridgeWrongMessage', event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Refrigerator Items</h2>
          <p className="text-sm text-gray-500">The refrigerator always keeps exactly 10 numbered slots.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {config.fridgeItems.map((item) => (
            <div key={item.slot} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slot {item.slot}</span>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  Value
                  <input
                    type="number"
                    min={0}
                    value={item.milligramValue}
                    onChange={(event) => updateFridgeItem(item.slot, { milligramValue: parseInt(event.target.value, 10) || 0 })}
                    className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <input
                  value={item.name}
                  onChange={(event) => updateFridgeItem(item.slot, { name: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <textarea
                  value={item.snarkyMessage}
                  onChange={(event) => updateFridgeItem(item.slot, { snarkyMessage: event.target.value })}
                  rows={2}
                  placeholder="Wrong choice message"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <textarea
                  value={item.correctMessage}
                  onChange={(event) => updateFridgeItem(item.slot, { correctMessage: event.target.value })}
                  rows={2}
                  placeholder="Correct choice message"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulletin Updates</h2>
              <p className="text-sm text-gray-500">Published notes appear in the Break Room bulletin modal.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingUpdate(emptyUpdate())}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus size={16} />
              New
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {updates.map((update) => (
              <div key={update.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-gray-900">{update.title}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase tracking-wide text-gray-600">{update.type}</span>
                    {update.published ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Published</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
                    )}
                    {update.pinned && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">Pinned</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500">{update.body}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUpdate(update)}
                    className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-emerald-600"
                    aria-label="Edit bulletin update"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUpdate(update)}
                    className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete bulletin update"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {updates.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                No bulletin updates yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {editingUpdate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{editingUpdate.id ? 'Edit Update' : 'New Update'}</h2>
                <button
                  type="button"
                  onClick={() => setEditingUpdate(null)}
                  className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  aria-label="Cancel editing"
                >
                  <X size={16} />
                </button>
              </div>

              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</span>
                <input
                  value={editingUpdate.title}
                  onChange={(event) => setEditingUpdate({ ...editingUpdate, title: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
                <select
                  value={editingUpdate.type}
                  onChange={(event) => setEditingUpdate({ ...editingUpdate, type: event.target.value as BreakRoomUpdateType })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {UPDATE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Body</span>
                <textarea
                  value={editingUpdate.body}
                  onChange={(event) => setEditingUpdate({ ...editingUpdate, body: event.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={editingUpdate.published}
                    onChange={(event) => setEditingUpdate({ ...editingUpdate, published: event.target.checked })}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={editingUpdate.pinned}
                    onChange={(event) => setEditingUpdate({ ...editingUpdate, pinned: event.target.checked })}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Pinned
                </label>
              </div>

              <button
                type="button"
                onClick={saveUpdate}
                disabled={isSavingUpdate}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSavingUpdate ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Update
              </button>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center text-center text-sm text-gray-500">
              Select an update or create a new one.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
