# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Academic_Research: Research advice, related literature finding, research area proposals, web knowledge access."""

import os

import google.auth
from dotenv import load_dotenv

from . import agent

load_dotenv()

# Only require GCP default auth if we are actually using Vertex AI
if os.environ.get("GOOGLE_GENAI_USE_VERTEXAI") == "1":
    try:
        _, project_id = google.auth.default()
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project_id)
        os.environ["GOOGLE_CLOUD_LOCATION"] = "global"
    except Exception as e:
        print(f"Warning: Failed to get Google Cloud credentials: {e}")
else:
    # Explicitly turn off vertex AI if it's set to 0
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "0"
