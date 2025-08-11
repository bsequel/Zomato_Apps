from datetime import datetime, timedelta
import random
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.contrib.auth import get_user_model
from .forms import AdminCreateUserForm
from django.contrib import messages
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from .forms import RegisterForm, LoginForm, RoleUpdateForm, AdminCreateUserForm
from .models import CustomUser
from .decorators import role_required


def home(request):
    return render(request, 'accounts/index.html')


VIEW_ONLY_EMAILS = ['view1@example.com', 'view2@example.com']
ADMIN_EMAILS = ['huzefa@gmail.com', 'bheem@gmail.com']


def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)

            if user.email in VIEW_ONLY_EMAILS:
                user.role = 'viewer'
            elif user.email in ADMIN_EMAILS:
                user.role = 'admin'
            else:
                user.role = 'viewer'

            user.save()
            return redirect('login')
    else:
        form = RegisterForm()
    return render(request, 'accounts/register.html', {'form': form})


def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            # username=email because USERNAME_FIELD='email'
            user = authenticate(request, username=email, password=password)
            if user is not None:
                login(request, user)
                return redirect('dashboard')
            else:
                form.add_error(None, 'Invalid email or password.')
    else:
        form = LoginForm()
    return render(request, 'accounts/login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('login')


@role_required('admin')
@login_required
def dashboard_view(request):
    if request.user.role != 'admin':
        return redirect('not_authorized')

    if request.method == 'POST':
        form = AdminCreateUserForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'User created successfully.')
            # Redirect to avoid re-submitting the form
            return redirect('dashboard')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = AdminCreateUserForm()

    users = CustomUser.objects.all()
    return render(request, 'accounts/dashboard.html', {
        'create_form': form,
        'users': users,
    })


User = get_user_model()


@require_POST
@login_required
def update_role_ajax(request):
    if not hasattr(request.user, 'role') or request.user.role != 'admin':
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    user_id = request.POST.get('user_id')
    new_role = request.POST.get('role')

    if new_role not in ['admin', 'viewer']:
        return JsonResponse({'success': False, 'error': 'Invalid role.'}, status=400)

    try:
        user = User.objects.get(pk=user_id)
        user.role = new_role
        user.save()
        return JsonResponse({'success': True, 'message': 'Role updated successfully.'})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found.'}, status=404)


@require_POST
@login_required
def create_user_ajax(request):
    if not hasattr(request.user, 'role') or request.user.role != 'admin':
        return JsonResponse({'success': False, 'error': 'Permission denied.'}, status=403)

    form = AdminCreateUserForm(request.POST)
    if form.is_valid():
        form.save()
        return JsonResponse({'success': True, 'message': 'User created successfully.'})
    else:
        return JsonResponse({'success': False, 'errors': form.errors.get_json_data()}, status=400)


@api_view(['GET'])
def dummy_cases_api(request):
    statuses = ['Pending', 'Picked', 'Closed']
    regions = ['North', 'South', 'East', 'West']
    stations = ['Station A', 'Station B', 'Station C', 'Station D']

    def random_date(start, end):
        return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

    start_date = datetime.now() - timedelta(days=180)
    end_date = datetime.now()
    cases = []
    for i in range(1, 61):  # 60 rows
        complaint_date = random_date(start_date, end_date)
        mail_date = complaint_date + timedelta(days=random.randint(0, 5))
        transaction_date = mail_date + timedelta(days=random.randint(0, 5))
        total_fraud = round(random.uniform(1000, 100000), 2)
        cases.append({
            'sno': i,
            'complaint_date': complaint_date.strftime('%Y-%m-%d'),
            'mail_date': mail_date.strftime('%Y-%m-%d'),
            'mail_month': mail_date.strftime('%B'),
            'amount': f'₹{round(random.uniform(1000, 100000), 2)}',
            'reference_number': f'REF{random.randint(10000,99999)}',
            'police_station_address': random.choice(stations),
            'account_number': f'{random.randint(10000000,99999999)}',
            'name': f'User {i}',
            'mobile_number': f'+91{random.randint(9000000000,9999999999)}',
            'email_id': f'user{i}@example.com',
            'status': random.choice(statuses),
            'ageing_days': (datetime.now() - complaint_date).days,
            'debit_from_bank': random.choice(['Yes', 'No']),
            'region': random.choice(regions),
            'utr_number': f'UTR{random.randint(1000000000,9999999999)}',
            'utr_amount': f'₹{round(random.uniform(1000, 100000), 2)}',
            'transaction_datetime': transaction_date.strftime('%Y-%m-%d %H:%M:%S'),
            'total_fraudulent_amount': f'₹{total_fraud}',
            'updated_on': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'updated_by': 'Admin',
        })
    total_amount = sum(
        float(c['total_fraudulent_amount'].replace('₹', '')) for c in cases)
    return Response({
        'cases': cases,
        'total_amount': f'₹{total_amount:,.2f}'
    })
