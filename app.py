import os

from flask import Flask, redirect, url_for

from double import double_bp


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
    )
    if test_config:
        app.config.update(test_config)

    # Остальные игры казино регистрируются здесь же, по аналогии:
    # app.register_blueprint(roulette_bp, url_prefix="/roulette")
    app.register_blueprint(double_bp, url_prefix="/double")

    @app.get("/")
    def index():
        return redirect(url_for("double.index"))

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
