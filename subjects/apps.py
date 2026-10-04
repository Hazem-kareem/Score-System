from django.apps import AppConfig


class SubjectsConfig(AppConfig):
    name = 'subjects'


class SubjectsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'subjects' 

    def ready(self):
        import subjects.signals  