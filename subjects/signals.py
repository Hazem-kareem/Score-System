from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from .models import Subject

@receiver([post_save, post_delete], sender=Subject)
def clear_subject_cache(sender, instance, **kwargs):
    cache.delete('subjects_list_all')