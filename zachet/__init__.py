"""Апгрейдер «Зачёт»: подключается к основному Flask-приложению как blueprint."""
from flask import Blueprint, render_template

bp = Blueprint('zachet', __name__,
               template_folder='templates',
               static_folder='static',
               static_url_path='/static')


@bp.route('/')
def index():
    return render_template('zachet/index.html')
