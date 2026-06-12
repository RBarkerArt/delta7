import React, { useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../hooks/useAuth';
import { Compass, BookOpen, Plus, Trash2, Edit2, X, Loader2, Upload, Radio } from 'lucide-react';

interface CompassReadout {
  id?: string;
  text: string;
  createdAt: any;
}

interface CartographerNote {
  id?: string;
  text: string;
  imageUrl?: string;
  caption?: string;
  createdAt: any;
}

interface TuningSignal {
  id?: string;
  type: 'verified' | 'unverified';
  category: 'marginalia' | 'label' | 'deadzone' | 'route' | 'object';
  title: string;
  text: string;
  createdAt: any;
}

export const AdminCartography: React.FC = () => {
  const { user } = useAuth();
  const [readouts, setReadouts] = useState<CompassReadout[]>([]);
  const [notes, setNotes] = useState<CartographerNote[]>([]);
  const [signals, setSignals] = useState<TuningSignal[]>([]);
  const [loadingReadouts, setLoadingReadouts] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingSignals, setLoadingSignals] = useState(true);

  // Editing state for Compass Readout
  const [editingReadout, setEditingReadout] = useState<CompassReadout | null>(null);
  const [savingReadout, setSavingReadout] = useState(false);

  // Editing state for Note
  const [editingNote, setEditingNote] = useState<CartographerNote | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Editing state for Signal
  const [editingSignal, setEditingSignal] = useState<TuningSignal | null>(null);
  const [savingSignal, setSavingSignal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to Compass Readouts
    const qReadouts = query(
      collection(db, 'system', 'cartography', 'compass_readouts'),
      orderBy('createdAt', 'desc')
    );
    const unsubReadouts = onSnapshot(
      qReadouts,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CompassReadout);
        setReadouts(list);
        setLoadingReadouts(false);
      },
      (err) => {
        console.error('Error fetching readouts:', err);
        setError('Failed to fetch compass readouts.');
        setLoadingReadouts(false);
      }
    );

    // Listen to Cartographer Notes
    const qNotes = query(
      collection(db, 'system', 'cartography', 'cartographer_notes'),
      orderBy('createdAt', 'desc')
    );
    const unsubNotes = onSnapshot(
      qNotes,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as CartographerNote);
        setNotes(list);
        setLoadingNotes(false);
      },
      (err) => {
        console.error('Error fetching notes:', err);
        setError('Failed to fetch cartographer notes.');
        setLoadingNotes(false);
      }
    );

    // Listen to Tuning Signals
    const qSignals = query(
      collection(db, 'system', 'cartography', 'tuning_signals'),
      orderBy('id', 'asc')
    );
    const unsubSignals = onSnapshot(
      qSignals,
      (snap) => {
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TuningSignal);
        setSignals(list);
        setLoadingSignals(false);
      },
      (err) => {
        console.error('Error fetching signals:', err);
        setError('Failed to fetch tuning signals.');
        setLoadingSignals(false);
      }
    );

    return () => {
      unsubReadouts();
      unsubNotes();
      unsubSignals();
    };
  }, []);

  // Image compression helper
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = (height / width) * MAX_DIM;
            width = MAX_DIM;
          } else {
            width = (width / height) * MAX_DIM;
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Compression failed'));
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !editingNote) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    setError(null);

    try {
      const compressedBlob = await compressImage(file);
      const filename = `${Date.now()}_${file.name.split('.')[0]}.webp`;
      const imageRef = ref(storage, `rooms/cartography/notes/${filename}`);
      
      await uploadBytes(imageRef, compressedBlob);
      const url = await getDownloadURL(imageRef);

      setEditingNote({
        ...editingNote,
        imageUrl: url,
      });
    } catch (err) {
      console.error('Image upload failed:', err);
      setError('Image upload failed.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const saveReadout = async () => {
    if (!editingReadout) return;
    const text = editingReadout.text.trim();
    if (!text) {
      setError('Readout text cannot be empty.');
      return;
    }

    setSavingReadout(true);
    setError(null);

    try {
      if (editingReadout.id) {
        const refDoc = doc(db, 'system', 'cartography', 'compass_readouts', editingReadout.id);
        await setDoc(refDoc, { text, createdAt: editingReadout.createdAt || Timestamp.now() }, { merge: true });
        
        await addDoc(collection(db, 'admin_events'), {
          action: 'cartography_compass_edit',
          readoutId: editingReadout.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      } else {
        const refCol = collection(db, 'system', 'cartography', 'compass_readouts');
        const created = await addDoc(refCol, { text, createdAt: Timestamp.now() });

        await addDoc(collection(db, 'admin_events'), {
          action: 'cartography_compass_create',
          readoutId: created.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      }
      setEditingReadout(null);
    } catch (err) {
      console.error('Error saving readout:', err);
      setError('Failed to save compass readout.');
    } finally {
      setSavingReadout(false);
    }
  };

  const deleteReadout = async (readout: CompassReadout) => {
    if (!readout.id || !window.confirm(`Delete compass readout "${readout.text}"?`)) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'system', 'cartography', 'compass_readouts', readout.id));
      await addDoc(collection(db, 'admin_events'), {
        action: 'cartography_compass_delete',
        readoutId: readout.id,
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      if (editingReadout?.id === readout.id) setEditingReadout(null);
    } catch (err) {
      console.error('Error deleting readout:', err);
      setError('Failed to delete readout.');
    }
  };

  const saveNote = async () => {
    if (!editingNote) return;
    const text = editingNote.text.trim();
    if (!text) {
      setError('Note text cannot be empty.');
      return;
    }

    setSavingNote(true);
    setError(null);

    try {
      const payload: Partial<CartographerNote> = {
        text,
        imageUrl: editingNote.imageUrl || '',
        caption: (editingNote.caption || '').trim(),
      };

      if (editingNote.id) {
        const refDoc = doc(db, 'system', 'cartography', 'cartographer_notes', editingNote.id);
        await setDoc(refDoc, { ...payload, createdAt: editingNote.createdAt || Timestamp.now() }, { merge: true });

        await addDoc(collection(db, 'admin_events'), {
          action: 'cartography_note_edit',
          noteId: editingNote.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      } else {
        const refCol = collection(db, 'system', 'cartography', 'cartographer_notes');
        const created = await addDoc(refCol, { ...payload, createdAt: Timestamp.now() });

        await addDoc(collection(db, 'admin_events'), {
          action: 'cartography_note_create',
          noteId: created.id,
          actorEmail: user?.email || null,
          createdAt: Timestamp.now(),
        });
      }
      setEditingNote(null);
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save note.');
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (note: CartographerNote) => {
    if (!note.id || !window.confirm(`Delete cartographer note?`)) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'system', 'cartography', 'cartographer_notes', note.id));
      await addDoc(collection(db, 'admin_events'), {
        action: 'cartography_note_delete',
        noteId: note.id,
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      if (editingNote?.id === note.id) setEditingNote(null);
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note.');
    }
  };

  const saveSignal = async () => {
    if (!editingSignal) return;
    const signalId = editingSignal.id?.trim().toLowerCase();
    const title = editingSignal.title.trim();
    const text = editingSignal.text.trim();
    const category = editingSignal.category;
    const type = editingSignal.type;

    if (!signalId) {
      setError('Signal ID cannot be empty (e.g. sig_008 or unv_008).');
      return;
    }
    if (!title || !text) {
      setError('Title and text cannot be empty.');
      return;
    }

    setSavingSignal(true);
    setError(null);

    try {
      const refDoc = doc(db, 'system', 'cartography', 'tuning_signals', signalId);
      const isNew = !signals.some(s => s.id === signalId);

      await setDoc(refDoc, {
        id: signalId,
        title,
        text,
        category,
        type,
        createdAt: editingSignal.createdAt || Timestamp.now()
      }, { merge: true });

      await addDoc(collection(db, 'admin_events'), {
        action: isNew ? 'cartography_signal_create' : 'cartography_signal_edit',
        signalId,
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });

      setEditingSignal(null);
    } catch (err) {
      console.error('Error saving signal:', err);
      setError('Failed to save tuning signal.');
    } finally {
      setSavingSignal(false);
    }
  };

  const deleteSignal = async (signal: TuningSignal) => {
    if (!signal.id || !window.confirm(`Delete tuning signal "${signal.title}" (${signal.id})?`)) return;
    setError(null);
    try {
      await deleteDoc(doc(db, 'system', 'cartography', 'tuning_signals', signal.id));
      await addDoc(collection(db, 'admin_events'), {
        action: 'cartography_signal_delete',
        signalId: signal.id,
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      if (editingSignal?.id === signal.id) setEditingSignal(null);
    } catch (err) {
      console.error('Error deleting signal:', err);
      setError('Failed to delete signal.');
    }
  };

  const renderLoading = (label: string) => (
    <div className="flex h-48 items-center justify-center text-sm text-gray-400">
      <Loader2 className="mr-2 animate-spin" size={16} />
      Loading {label}...
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Title block */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cartography</h1>
        <p className="text-sm text-gray-500">Manage daily compass anomalies and Kael's drafting logs.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* COMPASS READOUTS SECTION */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Compass size={20} className="text-emerald-600" />
              Compass Anomalies
            </h2>
            <button
              onClick={() => setEditingReadout({ text: '', createdAt: null })}
              className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-2.5 py-1.5 rounded hover:bg-emerald-700 transition"
            >
              <Plus size={14} /> Add Readout
            </button>
          </div>

          {editingReadout && (
            <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingReadout.id ? 'Edit Readout' : 'New Readout'}
              </h3>
              <textarea
                value={editingReadout.text}
                onChange={(e) => setEditingReadout({ ...editingReadout, text: e.target.value })}
                rows={3}
                placeholder="Needle favors the east wall..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingReadout(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReadout}
                  disabled={savingReadout}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {savingReadout ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {loadingReadouts ? (
            renderLoading('readouts')
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
              {readouts.map((r) => (
                <div key={r.id} className="p-3 flex items-start justify-between gap-4 hover:bg-gray-50 transition">
                  <p className="text-sm text-gray-700 leading-relaxed">{r.text}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingReadout(r)}
                      className="p-1 text-gray-400 hover:text-emerald-600 transition"
                      aria-label="Edit readout"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteReadout(r)}
                      className="p-1 text-gray-400 hover:text-red-600 transition"
                      aria-label="Delete readout"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {readouts.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">No compass readouts recorded.</p>
              )}
            </div>
          )}
        </section>

        {/* CARTOGRAPHER NOTES SECTION */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen size={20} className="text-emerald-600" />
              Cartographer Notes
            </h2>
            <button
              onClick={() => setEditingNote({ text: '', imageUrl: '', caption: '', createdAt: null })}
              className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-2.5 py-1.5 rounded hover:bg-emerald-700 transition"
            >
              <Plus size={14} /> Add Note
            </button>
          </div>

          {editingNote && (
            <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingNote.id ? 'Edit Note' : 'New Note'}
              </h3>
              
              <div className="space-y-3">
                <textarea
                  value={editingNote.text}
                  onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })}
                  rows={4}
                  placeholder="I drew the facility from memory today..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-gray-500 uppercase">Evidence Image</span>
                  {editingNote.imageUrl ? (
                    <div className="relative w-40 aspect-video border rounded overflow-hidden bg-black/5">
                      <img src={editingNote.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditingNote({ ...editingNote, imageUrl: '' })}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
                        aria-label="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition">
                      <Upload size={16} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {uploadingImage ? 'Uploading WebP...' : 'Upload blueprint/sketch (WebP format auto-comp)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {editingNote.imageUrl && (
                  <input
                    value={editingNote.caption}
                    onChange={(e) => setEditingNote({ ...editingNote, caption: e.target.value })}
                    placeholder="Image Caption..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setEditingNote(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNote}
                  disabled={savingNote || uploadingImage}
                  className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {savingNote ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {loadingNotes ? (
            renderLoading('notes')
          ) : (
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto border border-gray-100 rounded-lg">
              {notes.map((n) => (
                <div key={n.id} className="p-4 flex flex-col sm:flex-row gap-4 hover:bg-gray-50 transition">
                  {n.imageUrl && (
                    <div className="w-24 sm:w-20 aspect-video border rounded overflow-hidden bg-black/5 shrink-0">
                      <img src={n.imageUrl} alt="Note asset" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{n.text}</p>
                    {n.caption && (
                      <span className="text-[10px] text-gray-400 mt-1 block italic">Caption: {n.caption}</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 justify-end sm:justify-start">
                    <button
                      onClick={() => setEditingNote(n)}
                      className="p-1 text-gray-400 hover:text-emerald-600 transition"
                      aria-label="Edit note"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteNote(n)}
                      className="p-1 text-gray-400 hover:text-red-600 transition"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">No notes written yet.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* TUNING SIGNALS SECTION */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Radio size={20} className="text-emerald-600" />
            Tuning Signals
          </h2>
          <button
            onClick={() => setEditingSignal({ id: '', type: 'verified', category: 'marginalia', title: '', text: '', createdAt: null })}
            className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-2.5 py-1.5 rounded hover:bg-emerald-700 transition"
          >
            <Plus size={14} /> Add Signal
          </button>
        </div>

        {editingSignal && (
          <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">
              {editingSignal.createdAt ? `Edit Signal: ${editingSignal.id}` : 'New Tuning Signal'}
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Signal ID</label>
                <input
                  type="text"
                  value={editingSignal.id}
                  disabled={editingSignal.createdAt !== null}
                  onChange={(e) => setEditingSignal({ ...editingSignal, id: e.target.value })}
                  placeholder="e.g. sig_008 or unv_008"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Tuning Type</label>
                <select
                  value={editingSignal.type}
                  onChange={(e) => setEditingSignal({ ...editingSignal, type: e.target.value as 'verified' | 'unverified' })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="verified">Verified (Standard Tune)</option>
                  <option value="unverified">Unverified (Overtune)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Category</label>
                <select
                  value={editingSignal.category}
                  onChange={(e) => setEditingSignal({ ...editingSignal, category: e.target.value as any })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="marginalia">Marginalia</option>
                  <option value="label">Label</option>
                  <option value="deadzone">Deadzone</option>
                  <option value="route">Route</option>
                  <option value="object">Object</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Title</label>
                <input
                  type="text"
                  value={editingSignal.title}
                  onChange={(e) => setEditingSignal({ ...editingSignal, title: e.target.value })}
                  placeholder="e.g. Broken Coil"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase">Signal Text / Lore Content</label>
              <textarea
                value={editingSignal.text}
                onChange={(e) => setEditingSignal({ ...editingSignal, text: e.target.value })}
                rows={3}
                placeholder="Content revealed to observer when tuned..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setEditingSignal(null)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveSignal}
                disabled={savingSignal}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-300"
              >
                {savingSignal ? 'Saving...' : 'Save Signal'}
              </button>
            </div>
          </div>
        )}

        {loadingSignals ? (
          renderLoading('signals')
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Content Snippet</th>
                  <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {signals.map((sig) => (
                  <tr key={sig.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{sig.id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{sig.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        sig.type === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {sig.type === 'verified' ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{sig.category}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{sig.text}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setEditingSignal(sig)}
                          className="p-1 text-gray-400 hover:text-emerald-600 transition"
                          aria-label="Edit signal"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteSignal(sig)}
                          className="p-1 text-gray-400 hover:text-red-600 transition"
                          aria-label="Delete signal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-sm text-gray-500 text-center">No tuning signals defined.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
