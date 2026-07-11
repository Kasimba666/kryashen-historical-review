import sys

with open('src/pages/IssueDetailPage.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: openEditArticleDialog
old1 = 'this.editArticleDialogVisible = true\n      this.articleForm = {\n        titleRu: this.getLocalized(article.title),\n        titleEn: article.title && article.title.en || '
new1 = 'this.editArticleDialogVisible = true\n      var titleObj = article.title || {}\n      this.articleForm = {\n        titleRu: article.titleRu || titleObj.ru || \'\',\n        titleEn: article.titleEn || titleObj.en || '
if old1 in content:
    content = content.replace(old1, new1)
    print("Fix 1 applied")
else:
    print("Fix 1 NOT found")

# Fix 2: error handling for 400
old2 = "if (Object.keys(pubData).length <= 1) return\n            return updatePublication(submissionId, publicationId, pubData)\n          })\n          .then(function () {\n            self.$message && self.$message.success('Изменения сохранены')\n            self.editArticleDialogVisible = false\n            self.editingArticle = null\n            self._editingSubmissionId = null\n            self._editingPublicationId = null\n            self._editingPublicationVersion = null\n            self.loadIssue()\n          })"

new2 = "if (Object.keys(pubData).length <= 1) return\n            var doUpdate = function () {\n              return updatePublication(submissionId, publicationId, pubData)\n            }\n            return doUpdate().catch(function (err) {\n              if (self.articleForm.titleEn && /400/.test(String(err.message || ''))) {\n                return enableContextLocale('en')\n                  .then(function () { return doUpdate() })\n                  .catch(function () {\n                    var fb = { version: self._editingPublicationVersion || 1 }\n                    if (self.articleForm.titleRu) fb.title = { ru: self.articleForm.titleRu }\n                    if (kwList.length) fb.keywords = { ru: kwList.filter(function (k) { return k && k.trim() }) }\n                    return updatePublication(submissionId, publicationId, fb).then(function () {\n                      self.$message && self.$message.warning(\n                        'Английское название не сохранено: журнал не поддерживает локаль «en». ' +\n                        'Сохранено только русское название. Включите English в настройках журнала ' +\n                        '(Settings → Journal → Languages).'\n                      )\n                    })\n                  })\n              }\n              throw err\n            })\n          })\n          .then(function () {\n            self.$message && self.$message.success('Изменения сохранены')\n            self.editArticleDialogVisible = false\n            self.editingArticle = null\n            self._editingSubmissionId = null\n            self._editingPublicationId = null\n            self._editingPublicationVersion = null\n            self.loadIssue()\n          })"

if old2 in content:
    content = content.replace(old2, new2)
    print("Fix 2 applied")
else:
    print("Fix 2 NOT found")
    idx = content.find('Object.keys(pubData).length <= 1')
    if idx > 0:
        print("Context:", repr(content[idx:idx+300]))

with open('src/pages/IssueDetailPage.vue', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")