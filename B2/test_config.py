"""Configuration contract checks; they never connect to a provider/database."""
import unittest
from B2.config import ConfigurationError, load_supabase_backend_config

GOOD = {
    "SUPABASE_URL": "https://project-ref.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "public-test-key",
    "B2_DATABASE_URL": "postgresql://user:password@db.example.test:5432/poshan",
    "B2_OPERATIONAL_STORE_KIND": "postgresql",
}


class BackendConfigurationTests(unittest.TestCase):
    def test_valid_settings_are_loaded_without_connecting(self):
        self.assertEqual(load_supabase_backend_config(GOOD).operational_store_kind, "postgresql")

    def test_missing_settings_are_named_without_echoing_values(self):
        with self.assertRaisesRegex(ConfigurationError, "SUPABASE_URL"):
            load_supabase_backend_config({})

    def test_provider_url_must_be_an_https_origin(self):
        for value in ("http://project.supabase.co", "https://user:pass@project.supabase.co", "https://project.supabase.co/path"):
            with self.subTest(value=value), self.assertRaises(ConfigurationError):
                load_supabase_backend_config({**GOOD, "SUPABASE_URL": value})

    def test_database_settings_are_validated(self):
        with self.assertRaisesRegex(ConfigurationError, "PostgreSQL"):
            load_supabase_backend_config({**GOOD, "B2_DATABASE_URL": "sqlite:///tmp.db"})
        with self.assertRaisesRegex(ConfigurationError, "OPERATIONAL_STORE_KIND"):
            load_supabase_backend_config({**GOOD, "B2_OPERATIONAL_STORE_KIND": "sqlite"})

    def test_errors_never_echo_database_url(self):
        url = "postgresql://secret-user:secret-password@db.example.test:5432/db"
        with self.assertRaises(ConfigurationError) as caught:
            load_supabase_backend_config({**GOOD, "SUPABASE_URL": "bad", "B2_DATABASE_URL": url})
        self.assertNotIn("secret-password", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
