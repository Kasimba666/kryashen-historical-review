import sys

# Verify ojs.js
with open('src/services/ojs.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("=== ojs.js checks ===")
print(f"obj.ru_RU || obj.en_US: {'obj.ru_RU || obj.en_US' in content}")
print(f"locale = locale || 'en_US': {''locale = locale || 'en_US'' in content}")
print(f"journal.primaryLocale || 'ru_RU': {'journal.primaryLocale || 'ru_RU'' in content}")
print(f"locale || 'ru_RU': {'locale || 'ru_RU'' in content}")

# Check no old patterns remain
print(f"obj.ru || obj.en (OLD): {'obj.ru || obj.en' in content}")
print(f"locale = locale || 'en' (OLD): {''locale = locale || 'en'' in content}")
print(f"journal.primaryLocale || 'ru' (OLD): {'journal.primaryLocale || 'ru'' in content}")

# Verify IssueDetailPage.vue
with open('src/pages/IssueDetailPage.vue', 'r', encoding='utf-8') as f:
    content = f.read()

print("\n=== IssueDetailPage.vue checks ===")
print(f"mergedTitle.ru_RU: {'mergedTitle.ru_RU' in content}")
print(f"mergedTitle.en_US: {'mergedTitle.en_US' in content}")
print(f"titleObj.ru_RU: {'titleObj.ru_RU' in content}")
print(f"titleObj.en_US: {'titleObj.en_US' in content}")
print(f"obj.ru_RU || obj.en_US: {'obj.ru_RU || obj.en_US' in content}")
print(f"kwObj.ru_RU || kwObj.en_US: {'kwObj.ru_RU || kwObj.en_US' in content}")
print(f"keywords: { ru_RU:: {'keywords: { ru_RU:' in content}")
print(f"locale: 'ru_RU': {''locale: 'ru_RU'' in content}")

# Check no old patterns remain
print(f"mergedTitle.ru (OLD): {'mergedTitle.ru' in content and 'mergedTitle.ru_RU' not in content}")
print(f"mergedTitle.en (OLD): {'mergedTitle.en' in content and 'mergedTitle.en_US' not in content}")
print(f"obj.ru || obj.en (OLD): {'obj.ru || obj.en' in content}")
print(f"locale: 'ru' (OLD): {''locale: 'ru'' in content}")