import sys

# Fix ojs.js
with open('src/services/ojs.js', 'r', encoding='utf-8') as f:
    content = f.read()

changes = {
    "obj.ru || obj.en": "obj.ru_RU || obj.en_US",
    "locale = locale || 'en'": "locale = locale || 'en_US'",
    "journal.primaryLocale || 'ru'": "journal.primaryLocale || 'ru_RU'",
}

for old, new in changes.items():
    content = content.replace(old, new)

# Fix locale defaults for uploadSubmissionFile and createGalley
content = content.replace("locale || 'ru'", "locale || 'ru_RU'")

with open('src/services/ojs.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("ojs.js done")

# Fix IssueDetailPage.vue
with open('src/pages/IssueDetailPage.vue', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    "mergedTitle.ru": "mergedTitle.ru_RU",
    "mergedTitle.en": "mergedTitle.en_US",
    "titleObj.ru": "titleObj.ru_RU",
    "titleObj.en": "titleObj.en_US",
    "obj.ru || obj.en": "obj.ru_RU || obj.en_US",
    "kwObj.ru || kwObj.en": "kwObj.ru_RU || kwObj.en_US",
    "keywords: { ru:": "keywords: { ru_RU:",
    "locale: 'ru'": "locale: 'ru_RU'",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('src/pages/IssueDetailPage.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print("IssueDetailPage.vue done")