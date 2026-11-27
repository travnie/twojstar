type PlaybackSubmissionOptions = {
  playlistIndex?: number;
  preserveSelection?: boolean;
  preserveAttempt?: boolean;
  mutedFallback?: boolean;
};

function parsedIndex(value: string | undefined): number {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

export function activePlaylistIndex(form: HTMLFormElement): number {
  return parsedIndex(form.dataset.streambenchActivePlaylistIndex);
}

export function setActivePlaylistIndex(form: HTMLFormElement, index: number): void {
  if (Number.isInteger(index) && index >= 0) form.dataset.streambenchActivePlaylistIndex = String(index);
  else delete form.dataset.streambenchActivePlaylistIndex;
}

export function playbackSubmissionContext(form: HTMLFormElement) {
  return {
    playlistIndex: parsedIndex(form.dataset.streambenchPlaylistIndex),
    preserveSelection: form.dataset.streambenchPreserveSelection === "true",
    preserveAttempt: form.dataset.streambenchPreserveAttempt === "true",
    mutedFallback: form.dataset.streambenchMutedFallback === "true",
  };
}

export function submitPlaybackForm(form: HTMLFormElement, {
  playlistIndex = activePlaylistIndex(form),
  preserveSelection = playlistIndex >= 0,
  preserveAttempt = false,
  mutedFallback = false,
}: PlaybackSubmissionOptions = {}): void {
  const previous = {
    playlistIndex: form.dataset.streambenchPlaylistIndex,
    preserveSelection: form.dataset.streambenchPreserveSelection,
    preserveAttempt: form.dataset.streambenchPreserveAttempt,
    mutedFallback: form.dataset.streambenchMutedFallback,
  };
  if (playlistIndex >= 0) form.dataset.streambenchPlaylistIndex = String(playlistIndex);
  else delete form.dataset.streambenchPlaylistIndex;
  if (preserveSelection) form.dataset.streambenchPreserveSelection = "true";
  else delete form.dataset.streambenchPreserveSelection;
  if (preserveAttempt) form.dataset.streambenchPreserveAttempt = "true";
  else delete form.dataset.streambenchPreserveAttempt;
  if (mutedFallback) form.dataset.streambenchMutedFallback = "true";
  else delete form.dataset.streambenchMutedFallback;
  try {
    form.requestSubmit();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      const datasetKey = "streambench" + key[0].toUpperCase() + key.slice(1);
      if (value === undefined) delete form.dataset[datasetKey];
      else form.dataset[datasetKey] = value;
    }
  }
}
