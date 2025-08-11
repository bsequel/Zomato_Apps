from django.db import models
# from django.contrib.auth.models import User  # If using Django's built-in User model

from django.conf import settings

class CyberCellReport(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('picked', 'Picked'),
        ('closed', 'Closed'),
    ]
    
    DEBIT_CHOICES = [
        ('yes', 'Yes'),
        ('no', 'No'),
    ]
    
    sno = models.AutoField(primary_key=True)
    complaint_date = models.CharField(max_length=255)
    mail_date = models.CharField(max_length=255)
    mail_month = models.CharField(max_length=255, null=True, blank=True)
    amount = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=255)
    police_station_address = models.CharField(max_length=255)
    account_number = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    mobile_number = models.CharField(max_length=255)
    email_id = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    ageing_days = models.CharField(max_length=255, null=True, blank=True)
    debit_from_bank = models.CharField(max_length=10, choices=DEBIT_CHOICES, default='no')
    region = models.CharField(max_length=255)
    utr_number = models.CharField(max_length=255)
    utr_amount = models.CharField(max_length=255)
    transaction_datetime = models.CharField(max_length=255)
    total_fraudulent_amount = models.CharField(max_length=255)

    updated_on = models.DateTimeField(auto_now=True)

    pdf_file = models.FileField(upload_to='uploaded_pdfs/', null=True, blank=True)
    # updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
     # ✅ use AUTH_USER_MODEL reference
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        db_table = 'cyber_report'
        managed = True

    def __str__(self):
        return f"Report {self.reference_number} - {self.name}"
