import sys

# Fix 1: openEditArticleDialog - read article.titleRu/titleEn directly
with open('src/pages/IssueDetailPage.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the openEditArticleDialog to read titleRu/titleEn directly
old = '''      this.editArticleDialogVisible = true
      this.articleForm = {
        titleRu: this.getLocalized(article.title),
        titleEn: article.title && article.title.en || ''','''

new = '''      this.editArticleDialogVisible = true
      // article.titleRu/titleEn — строки из enrichArticles (основной источник).
      // Если их нет — fallback на article.title (объект {ru, en} из API).
      var titleObj = article.title || {}
      this.articleForm = {
        titleRu: article.titleRu || titleObj.ru || '',
        titleEn: article.titleEn || titleObj.en || ''','''

if old in content:
    content = content.replace(old, new)
    print("Fix 1 applied: openEditArticleDialog reads titleRu/titleEn directly")
else:
    print("Fix 1: pattern not found, trying alternative...")
    # Try without the trailing comma
    old2 = '''      this.editArticleDialogVisible = true
      this.articleForm = {
        titleRu: this.getLocalized(article.title),
        titleEn: article.title && article.title.en || ''','''
    if old2 in content:
        content = content.replace(old2, new)
        print("Fix 1 applied (alt pattern)")
    else:
        print("Fix 1: pattern still not found")

# Fix 2: Add error handling for 400 in saveArticleEdit
old_catch = '''            if (Object.keys(pubData).length <= 1) return
            return updatePublication(submissionId, publicationId, pubData)
          })
          .then(function () {
            self.$message && self.$message.success('Изменения сохранены')
            self.editArticleDialogVisible = false
            self.editingArticle = null
            self._editingSubmissionId = null
            self._editingPublicationId = null
            self._editingPublicationVersion = null
            self.loadIssue()
          })'''

new_catch = '''            if (Object.keys(pubData).length <= 1) return
            var doUpdate = function () {
              return updatePublication(submissionId, publicationId, pubData)
            }
            return doUpdate().catch(function (err) {
              if (self.articleForm.titleEn && /400/.test(String(err.message || ''))) {
                return enableContextLocale('en')
                  .then(function () { return doUpdate() })
                  .catch(function () {
                    // Сохраняем только RU
                    var fb = { version: self._editingPublicationVersion || 1 }
                    if (self.articleForm.titleRu) fb.title = { ru: self.articleForm.titleRu }
                    if (kwList.length) fb.keywords = { ru: kwList.filter(function (k) { return k && k.trim() }) }
                    return updatePublication(submissionId, publicationId, fb).then(function () {
                      self.$message && self.$message.warning(
                        'Английское название не сохранено: журнал не поддерживает локаль «en». ' +
                        'Сохранено только русское название. Включите English в настройках журнала ' +
                        '(Settings → Journal → Languages).'
                      )
                    })
                  })
              }
              throw err
            })
          })
          .then(function () {
            self.$message && self.$message.success('Изменения сохранены')
            self.editArticleDialogVisible = false
            self.editingArticle = null
            self._editingSubmissionId = null
            self._editingPublicationId = null
            self._editingPublicationVersion = null
            self.loadIssue()
          })'''

if old_catch in content:
    content = content.replace(old_catch, new_catch)
    print("Fix 2 applied: error handling for 400 added")
else:
    print("Fix 2: pattern not found")
    # Debug: show what's around that area
    idx = content.find('Object.keys(pubData).length <= 1')
    if idx > 0:
        print("Found at", idx)
        print(repr(content[idx:idx+500]))

with open('src/pages/IssueDetailPage.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print("\nDone")