from django.urls import path
from . import views
# from .views import dummy_cases_api



urlpatterns = [
    path('',views.home),
    path('register/', views.register_view, name='register'),
    # path('login/', views.login_view, name='login'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('home/', views.home_view, name='home'),
    path('update-role/', views.update_role_ajax, name='update_role_ajax'),
    # path('api/dummy-cases/', dummy_cases_api, name='dummy_cases_api'),
    path('api/dummy-cases/', views.dummy_cases_api, name='dummy_cases_api'),

    path('create-user/', views.create_user_ajax, name='create_user_ajax'),

]
