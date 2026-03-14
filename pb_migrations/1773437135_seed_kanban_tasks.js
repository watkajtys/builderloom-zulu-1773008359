/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Dao(db).findCollectionByNameOrId("88ov7uqyv7fclhz");

  const tasks = [
    { title: "Optimize Neural Paths", status: "todo", order: 0 },
    { title: "Calibrate Quantum Matrix", status: "todo", order: 1 },
    { title: "Synchronize Data Streams", status: "in_progress", order: 0 },
    { title: "Initialize Core Logic", status: "in_progress", order: 1 },
    { title: "Review Memory Allocation", status: "done", order: 0 },
    { title: "Deploy Update 2.4", status: "done", order: 1 }
  ];

  tasks.forEach((task) => {
    const record = new Record(collection);
    record.set("title", task.title);
    record.set("status", task.status);
    record.set("order", task.order);
    new Dao(db).saveRecord(record);
  });
}, (db) => {
  const dao = new Dao(db);
  const records = dao.findRecordsByExpr("kanban_tasks");
  records.forEach((record) => {
    dao.deleteRecord(record);
  });
});
