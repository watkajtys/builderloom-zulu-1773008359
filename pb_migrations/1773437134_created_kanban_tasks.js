/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "88ov7uqyv7fclhz",
    "created": "2026-03-13 21:25:34.430Z",
    "updated": "2026-03-13 21:25:34.430Z",
    "name": "kanban_tasks",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "tjocrwfn",
        "name": "title",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "caooyylo",
        "name": "status",
        "type": "select",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "backlog",
            "analysis",
            "synthesizing",
            "validation"
          ]
        }
      },
      {
        "system": false,
        "id": "qsxznxun",
        "name": "order",
        "type": "number",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "noDecimal": false
        }
      }
    ],
    "indexes": [],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("88ov7uqyv7fclhz");

  return dao.deleteCollection(collection);
})
