import json
import tempfile
import unittest
from pathlib import Path

from benchmark import _interpolate, choose_events, damage, normalize_peak, read_wav, score, write_wav


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.samples = [
            [int(12000 * __import__("math").sin(index * 0.07))]
            for index in range(512)
        ]
        self.samples[100][0] = 20000
        self.samples[220][0] = -21000
        self.samples[360][0] = 19000
        self.samples = normalize_peak(self.samples, 2)

    def test_wav_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.wav"
            write_wav(path, 48000, 1, 2, self.samples)
            self.assertEqual((48000, 1, 2, self.samples), read_wav(path))

    def test_event_placement_is_deterministic_and_separated(self):
        first = choose_events(self.samples, 2)
        second = choose_events(self.samples, 2)
        self.assertEqual(first, second)
        self.assertTrue(
            all(
                second_index["start"] - first_index["start"] >= 32
                for first_index, second_index in zip(first, first[1:])
            )
        )

    def test_baselines_are_transparent_outside_events(self):
        events = choose_events(self.samples, 2)
        clean = _interpolate(self.samples, 2, events, False)
        cubic = _interpolate(self.samples, 2, events, True)
        event_frames = {
            frame
            for event in events
            for frame in range(event["start"], event["start"] + event["length"])
        }
        for frame, values in enumerate(clean):
            if frame not in event_frames:
                self.assertEqual(values, self.samples[frame])
                self.assertEqual(cubic[frame], self.samples[frame])

    def test_damage_changes_only_the_selected_channel(self):
        samples = [[1000, -2000] for _ in range(16)]
        events = [{"start": 6, "length": 2, "channel": 1, "polarity": -1}]
        damaged = damage(samples, 2, events)
        self.assertEqual(damaged[6][0], samples[6][0])
        self.assertEqual(damaged[7][0], samples[7][0])
        self.assertEqual(damaged[6][1], -32768)
        self.assertEqual(damaged[7][1], -32768)
        self.assertEqual(damaged[:6], samples[:6])
        self.assertEqual(damaged[8:], samples[8:])
    def test_known_linear_and_cubic_interpolation(self):
        clean = [[0], [0], [10], [20], [30], [40], [50], [60], [70]]
        events = [{"start": 2, "length": 4, "channel": 0, "polarity": 1}]
        self.assertEqual(_interpolate(clean, 2, events, False)[2:6], [[10], [20], [30], [40]])
        self.assertEqual(_interpolate(clean, 2, events, True)[2:6], [[4], [13], [25], [38]])

    def test_score_reports_prepared_baselines(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            events = choose_events(self.samples, 2)
            damaged = damage(self.samples, 2, events)
            write_wav(root / "clean.wav", 48000, 1, 2, self.samples)
            write_wav(root / "linear.wav", 48000, 1, 2, _interpolate(self.samples, 2, events, False))
            write_wav(root / "cubic.wav", 48000, 1, 2, _interpolate(self.samples, 2, events, True))
            write_wav(root / "damaged.wav", 48000, 1, 2, damaged)
            (root / "events.json").write_text(
                json.dumps({"events": events}), encoding="utf-8"
            )
            report = score(root, {})
            self.assertIn("damaged", report["methods"])
            self.assertIn("linear", report["methods"])
            self.assertIn("cubic_hermite", report["methods"])
            self.assertGreater(report["methods"]["damaged"]["clipped_region_rmse"], 0)
            self.assertEqual(
                report["methods"]["damaged"][
                    "max_absolute_error_outside_evaluation_windows"
                ],
                0,
            )


if __name__ == "__main__":
    unittest.main()
