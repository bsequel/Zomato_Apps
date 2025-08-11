


from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('viewer', 'Viewer'),
    )
    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES, default='viewer'
    )

    # Make email unique and require email for login standardization
    email = models.EmailField(unique=True)

    # Set email as USERNAME_FIELD for authentication by email, not username
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']  # username still required by AbstractUser, but no login by username

    def __str__(self):
        # Prefer email string representation; fallback to username
        return self.email if self.email else self.username



