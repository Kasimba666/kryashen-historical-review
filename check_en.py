c = open('src/pages/IssueDetailPage.vue', encoding='utf-8').read()
idx = c.find("'en'")
if idx >= 0:
    print("Found 'en' at position", idx)
    print("Context:", c[max(0,idx-50):idx+80])
else:
    print("No 'en' found")