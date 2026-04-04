# CMS Data Dump

API: `http://localhost:3000/shop-api` (public) / `http://localhost:3000/admin-api` (auth required)

## Translation Languages

```json
[
  {"id":"1","code":"en","name":"English","enabled":true,"isDefault":false,"position":0},
  {"id":"2","code":"fr","name":"French","enabled":true,"isDefault":true,"position":1},
  {"id":"3","code":"de","name":"Allemand","enabled":true,"isDefault":false,"position":2}
]
```

Default language = `fr` (content in CMS is written in French).

## Pages Overview

| id | key | name | enabled | type | pinnedInSidebar |
|----|-----|------|---------|------|-----------------|
| 1 | Blog | Blog | true | Collection | yes (order:100) |
| 3 | a | a | true | Regular | no |
| 4 | contactr | contact | true | Submission form | no |
| 5 | Contacts | Contacts | true | Submission form | yes |
| 6 | aa | aa | true | Collection | yes |
| 7 | zzz | azz | false | Collection | no |

Pages 4 and 5 are submission forms (not publicly translatable, not shown in translation UI).

## Page 1: Blog (Collection)

### Page translations
```json
[
  {"languageCode":"en","name":"azeazeaze","slug":"aaaaa"},
  {"languageCode":"fr","name":"Blog","slug":"Blog"}
]
```

### Content block schema (template for entries)
```json
[
  {"id":"14","key":"NomArticle","type":"TEXT_LONG","position":0,"metadata":{"maxLength":2000}},
  {"id":"3","key":"TexteArticle","type":"RICH_TEXT","position":1},
  {"id":"15","key":"ArticleActif","type":"BOOLEAN","position":2,"metadata":{"trueLabel":"Yes","falseLabel":"No"}},
  {"id":"20","key":"ImageArticle","type":"IMAGE","position":3,"featuredAssetId":"52"}
]
```

### Collection entries (FormSubmissions)

**Entry 30** (created 2026-03-25):
```json
{"azeaze":"<p>azeaze</p>","teste":"azeaze","aze":true}
```
No translations saved.

**Entry 34** (created 2026-03-26):
```json
{"TexteArticle":"<p><strong>Bonjour blabla</strong></p>","NomArticle":"1er article","ArticleActif":true,"ImageArticle":"53"}
```

Translations for entry 34:
```json
{
  "en": {"NomArticle":"1st article","TexteArticle":"<p><strong>Bonjour blabla</strong></p>","ImageArticle":"53"},
  "fr": {"NomArticle":"1er article","TexteArticle":"<p><strong>Bonjour blabla</strong></p>","ImageArticle":"53"},
  "de": {"NomArticle":"der article","TexteArticle":"<p><strong>Bonjour blabla</strong></p>","ImageArticle":"53"}
}
```

## Page 3: a (Regular page)

### Content blocks
```json
[
  {"id":"8","key":"azeazeazeaze","type":"IMAGE","position":0,"featuredAsset":{"id":"52","preview":"http://localhost:3000/assets/preview/d0/ruslan-bardash-351288-unsplash__preview.jpg"},"translations":[{"languageCode":"en","altText":"aze"}]},
  {"id":"6","key":"test","type":"BOOLEAN","position":1,"metadata":{"trueLabel":"Bonjoure","falseLabel":"Aurevoire"}},
  {"id":"7","key":"ezrezrze","type":"TEXT_SHORT","position":2,"metadata":{"maxLength":255},"translations":[{"languageCode":"en","textContent":"Test"}]},
  {"id":"9","key":"zerzerzer","type":"ENUM","position":3,"translations":[{"languageCode":"en","textContent":"Test\nTest2\nTest3"}]},
  {"id":"10","key":"qsdqsd","type":"RICH_TEXT","position":4,"translations":[{"languageCode":"en","textContent":"<p><strong>dqfsdqfsdf</strong></p>"}]},
  {"id":"11","key":"ccccccccccc","type":"IMAGE_GALLERY","position":5,"metadata":{"assetIds":["53","52"]}}
]
```

### Saved translations
```json
{
  "en": {
    "page|name":"b",
    "page|slug":"b",
    "7|textContent":"Testb",
    "9|textContent":"TestTest2Test3b",
    "10|textContent":"<p><strong>dqfsdqfsdfb</strong></p>",
    "8|image":"51"
  },
  "fr": {
    "page|name":"a",
    "page|slug":"a",
    "8|image":"52",
    "7|textContent":"Test",
    "9|textContent":"Test\nTest2\nTest3",
    "10|textContent":"<p><strong>dqfsdqfsdf</strong></p>"
  },
  "de": {
    "page|name":"c",
    "page|slug":"c",
    "7|textContent":"Testc",
    "9|textContent":"TestTest2Test3c",
    "10|textContent":"<p><strong>dqfsdqfsdfc</strong></p>",
    "8|image":"50"
  }
}
```

Key format: `contentBlockId|fieldName` or `page|fieldName` for page-level fields.

## Page 4: contactr (Submission form)

### Content block schema
```json
[
  {"id":"12","key":"name","type":"TEXT_SHORT","position":0,"metadata":{"maxLength":255}},
  {"id":"13","key":"content","type":"TEXT_LONG","position":1,"metadata":{"maxLength":2000}}
]
```

### Submissions (29 total, sample)
```json
[
  {"id":"1","data":{"name":"John Doe","content":"Hello, this is a test message from the contact form!"}},
  {"id":"2","data":{"name":"Jane Smith","content":"Another test - checking the submissions panel works!"}}
]
```

## Page 5: Contacts (Submission form)

### Content block schema
```json
[
  {"id":"16","key":"email","type":"TEXT_SHORT","position":0},
  {"id":"17","key":"firstName","type":"TEXT_SHORT","position":1},
  {"id":"18","key":"lastName","type":"TEXT_SHORT","position":2},
  {"id":"19","key":"phone","type":"NUMBER","position":3}
]
```

### Submissions (3 total)
```json
[
  {"id":"31","data":{"email":"jean.dupont@example.com","firstName":"Jean","lastName":"Dupont","phone":"+33612345678"}},
  {"id":"32","data":{"email":"marie.martin@example.com","firstName":"Marie","lastName":"Martin","phone":"+33698765432"}},
  {"id":"33","data":{"email":"pierre.bernard@example.com","firstName":"Pierre","lastName":"Bernard","phone":"+33655443322"}}
]
```

## Page 6: aa (Collection, empty entries)

### Content block schema
```json
[{"id":"21","key":"","type":"TEXT_SHORT","position":0,"metadata":{"maxLength":255}}]
```
1 empty entry, no translations.

## Page 7: zzz (Collection, disabled)

### Content block schema
```json
[{"id":"22","key":"","type":"TEXT_SHORT","position":0,"metadata":{"maxLength":255}}]
```
1 empty entry, no translations.

## Referenced Assets (used by CMS)

| id | name | preview |
|----|------|---------|
| 50 | (asset 50) | Use `asset(id:"50")` query to get URL |
| 51 | (asset 51) | Use `asset(id:"51")` query to get URL |
| 52 | ruslan-bardash-351288-unsplash.jpg | `http://localhost:3000/assets/preview/d0/ruslan-bardash-351288-unsplash__preview.jpg` |
| 53 | (asset 53) | Use `asset(id:"53")` query to get URL |

Asset URLs follow pattern: `http://localhost:3000/assets/preview/{hash}/{filename}__preview.jpg`
Use `?preset=thumb` for thumbnails, `?preset=medium` for medium size.

## Shop API Queries (for frontend)

### Get a page with all content
```graphql
query { cmsPageByKey(key: "Blog") { id key name slug enabled isCollection contentBlocks { id key type position metadata featuredAsset { id preview } translations { languageCode name textContent altText } } } }
```

### Get translations for a page
```graphql
query { cmsPageTranslationsByKey(pageKey: "a", languageCode: "en") { entries { contentBlockId fieldName value } } }
```

### Get collection entries
```graphql
query { formSubmissions(pageId: "1", options: { take: 50 }) { items { id createdAt data } totalItems } }
```
Note: `formSubmissions` is admin-only. From shop API, collection entries are fetched via `cmsPageByKey` which returns the template blocks. Actual entries need to be queried from admin API or exposed via a custom shop resolver.

### Get translations for a collection entry
```graphql
query { collectionEntryTranslations(pageId: "1", entryId: "34", languageCode: "en") { entries { fieldName value } } }
```

### Submit a form (shop API)
```graphql
mutation { submitForm(input: { pageKey: "contactr", fields: { name: "Test", content: "Hello" } }) { success } }
```

## Content Block Types Reference

| Type | Translatable fields | Value format |
|------|-------------------|--------------|
| TEXT_SHORT | textContent | Plain text (max 255) |
| TEXT_LONG | textContent | Plain text (max 2000) |
| RICH_TEXT | textContent | HTML string |
| IMAGE | image | Asset ID (string) |
| BOOLEAN | - | true/false |
| NUMBER | - | numeric |
| ENUM | textContent | Newline-separated options |
| IMAGE_GALLERY | - | metadata.assetIds array |
| DATE | - | ISO date string |
