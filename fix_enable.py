c = open('src/pages/IssueDetailPage.vue', encoding='utf-8').read()
c = c.replace("enableContextLocale('en')", "enableContextLocale('en_US')")
open('src/pages/IssueDetailPage.vue', 'w', encoding='utf-8').write(c)
print('Fixed enableContextLocale in IssueDetailPage.vue')