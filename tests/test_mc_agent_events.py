import importlib.util
import pathlib
import queue
import unittest
from unittest.mock import patch


AGENT_PATH = pathlib.Path(__file__).resolve().parents[1] / "vm" / "mc-agent.py"
SPEC = importlib.util.spec_from_file_location("mc_agent_under_test", AGENT_PATH)
agent = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent)


class PlayerEventWatcherTests(unittest.TestCase):
    def setUp(self):
        with agent._PLAYER_EVENT_LOCK:
            agent._PLAYER_EVENT_SUBSCRIBERS.clear()
            agent._PLAYER_EVENT_THREAD = None
            agent._PLAYER_EVENT_SNAPSHOT = None
            agent._PLAYER_EVENT_LAST_CHECKED_AT = None

    def tearDown(self):
        with agent._PLAYER_EVENT_LOCK:
            agent._PLAYER_EVENT_SUBSCRIBERS.clear()
            agent._PLAYER_EVENT_THREAD = None
            agent._PLAYER_EVENT_SNAPSHOT = None
            agent._PLAYER_EVENT_LAST_CHECKED_AT = None

    def test_publish_deduplicates_unchanged_status_and_keeps_latest_value(self):
        subscriber = queue.Queue(maxsize=1)
        with agent._PLAYER_EVENT_LOCK:
            agent._PLAYER_EVENT_SUBSCRIBERS.add(subscriber)

        first = {"available": True, "vm": "VM running", "players": 1}
        agent._publish_player_snapshot(first)
        published = subscriber.get_nowait()
        self.assertEqual(published["players"], 1)

        agent._publish_player_snapshot(first)
        self.assertTrue(subscriber.empty(), "unchanged snapshots must not emit duplicate events")

        agent._publish_player_snapshot({"available": True, "vm": "VM running", "players": 2})
        self.assertEqual(subscriber.get_nowait()["players"], 2)
        self.assertTrue(subscriber.empty())

    def test_watcher_reads_without_ip_and_exits_after_last_subscriber_leaves(self):
        subscriber = queue.Queue(maxsize=1)
        with agent._PLAYER_EVENT_LOCK:
            agent._PLAYER_EVENT_SUBSCRIBERS.add(subscriber)

        calls = []

        def read_status(*, include_ip=True):
            calls.append(include_ip)
            return {
                "vm": "VM running",
                "docker": "active",
                "container": "running",
                "players": 2,
                "player_names": ["private-player"],
                "ip": "203.0.113.10",
                "port_open": True,
                "rcon_ready": True,
                "geyser_ready": True,
            }

        def release_last_subscriber(_seconds):
            with agent._PLAYER_EVENT_LOCK:
                agent._PLAYER_EVENT_SUBSCRIBERS.discard(subscriber)

        with patch.object(agent, "read_status", side_effect=read_status), patch.object(
            agent.time, "sleep", side_effect=release_last_subscriber
        ):
            agent._watch_player_events()

        self.assertEqual(calls, [False])
        event = subscriber.get_nowait()
        self.assertEqual(event["players"], 2)
        self.assertNotIn("ip", event)
        self.assertNotIn("player_names", event)
        with agent._PLAYER_EVENT_LOCK:
            self.assertIsNone(agent._PLAYER_EVENT_THREAD)
            self.assertIsNone(agent._PLAYER_EVENT_SNAPSHOT)
            self.assertIsNone(agent._PLAYER_EVENT_LAST_CHECKED_AT)

    def test_multiple_subscribers_receive_the_same_change(self):
        first = queue.Queue(maxsize=1)
        second = queue.Queue(maxsize=1)
        with agent._PLAYER_EVENT_LOCK:
            agent._PLAYER_EVENT_SUBSCRIBERS.update((first, second))

        agent._publish_player_snapshot({"available": True, "vm": "VM running", "players": 4})

        self.assertEqual(first.get_nowait()["players"], 4)
        self.assertEqual(second.get_nowait()["players"], 4)


if __name__ == "__main__":
    unittest.main()
