# Fix reading keys back to short codes (ru, en) since OJS API returns short codes for reading
# and only uses long codes (ru_RU, en_US) for writing

with open('src/pages/IssueDetailPage.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# These are READING operations - revert to short codes
reading_fixes = {
    "return obj.ru_RU || obj.en_US || '':": "return obj.ru || obj.en || '':",
    "var arr = kwObj.ru_RU || kwObj.en_US || []": "var arr = kwObj.ru || kwObj.en || []",
    "titleRu: titleObj.ru_RU || '',": "titleRu: titleObj.ru || '',",
    "titleEn: titleObj.en_US || '',": "titleEn: titleObj.en || '',",
}

# These are WRITING operations - keep long codes
# mergedTitle.ru_RU, mergedTitle.en_US, enableContextLocale('en_US') - keep as is

for old, new in reading_fixes.items():
    if old in content:
        content = content.replace(old, new)
        print(f"Fixed: {old}")
    else:
        print(f"NOT FOUND: {old}")

with open('src/pages/IssueDetailPage.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print("\nDone with IssueDetailPage.vue")