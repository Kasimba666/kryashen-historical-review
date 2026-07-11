# REVERT ALL changes - restore both files to original state

# First, restore ojs.js from git
import subprocess
result = subprocess.run(['git', 'checkout', '--', 'src/services/ojs.js'], capture_output=True, text=True, cwd='.')
print("ojs.js restore:", result.stdout, result.stderr)

result = subprocess.run(['git', 'checkout', '--', 'src/pages/IssueDetailPage.vue'], capture_output=True, text=True, cwd='.')
print("IssueDetailPage.vue restore:", result.stdout, result.stderr)