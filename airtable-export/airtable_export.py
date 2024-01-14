import click
import httpx
from httpx import HTTPError
import json as json_
import pathlib
from urllib.parse import quote, urlencode
import sqlite_utils
import time
import yaml as yaml_
import csv as csv_module  # Rename the imported CSV module

@click.command()
@click.version_option()
@click.argument(
    "output_path",
    type=click.Path(file_okay=False, dir_okay=True, allow_dash=False),
    required=True,
)
@click.argument(
    "base_id",
    type=str,
    required=True,
)
@click.argument("tables", type=str, nargs=-1)
@click.option("--key", envvar="AIRTABLE_KEY", help="Airtable API key", required=True)
@click.option(
    "--http-read-timeout",
    help="Timeout (in seconds) for network read operations",
    type=int,
)
@click.option("--user-agent", help="User agent to use for requests")
@click.option("-v", "--verbose", is_flag=True, help="Verbose output")
@click.option("--json", is_flag=True, help="JSON format")
@click.option("--ndjson", is_flag=True, help="Newline delimited JSON format")
@click.option("--yaml", is_flag=True, help="YAML format (default)")
@click.option("--csv", is_flag=True, help="CSV format")  # Add CSV option
@click.option(
    "--sqlite",
    type=click.Path(file_okay=True, dir_okay=False, allow_dash=False),
    help="Export to this SQLite database",
)
@click.option(
    "--schema",
    is_flag=True,
    help="Save Airtable schema to output_path/_schema.json",
)
def cli(
    output_path,
    base_id,
    tables,
    key,
    http_read_timeout,
    user_agent,
    verbose,
    json,
    ndjson,
    yaml,
    csv,  # Add csv parameter
    sqlite,
    schema,
):
    "Export Airtable data to YAML file on disk"
    output = pathlib.Path(output_path)
    output.mkdir(parents=True, exist_ok=True)
    if not json and not ndjson and not yaml and not sqlite and not csv:
        yaml = True
    write_batch = lambda table, batch: None
    if sqlite:
        db = sqlite_utils.Database(sqlite)
        write_batch = lambda table, batch: db[table].insert_all(
            batch, pk="airtable_id", replace=True, alter=True
        )
    if csv:  # CSV batch writing function
        def write_csv_batch(table, batch):
            filename = f"{table}.csv"
            with open(output / filename, 'a', newline='', encoding='utf-8') as csvfile:
                writer = csv_module.DictWriter(csvfile, fieldnames=batch[0].keys())
                # ... [rest of your CSV writing logic] ...
                if csvfile.tell() == 0:  # Write header only for an empty file
                    writer.writeheader()
                writer.writerows(batch)

        write_batch = write_csv_batch

    if not tables or schema:
        # Fetch all tables
        schema_data = list_tables(base_id, key, user_agent=user_agent)
        dumped_schema = json_.dumps(schema_data, sort_keys=True, indent=4)
        (output / "_schema.json").write_text(dumped_schema, "utf-8")
        if not tables:
            tables = [table["name"] for table in schema_data["tables"]]

    for table in tables:
        records = []
        try:
            db_batch = []
            for record in all_records(
                base_id, table, key, http_read_timeout, user_agent=user_agent
            ):
                r = {
                    **{"airtable_id": record["id"]},
                    **record["fields"],
                    **{"airtable_createdTime": record["createdTime"]},
                }
                records.append(r)
                db_batch.append(r)
                if len(db_batch) == 100:
                    write_batch(table, db_batch)
                    db_batch = []
            write_batch(table, db_batch)  # Make sure the last batch is written
        except HTTPError as exc:
            raise click.ClickException(exc)
        filenames = []
        if json:
            filename = "{}.json".format(table)
            dumped = json_.dumps(records, sort_keys=True, indent=4)
            (output / filename).write_text(dumped, "utf-8")
            filenames.append(output / filename)
        if ndjson:
            filename = "{}.ndjson".format(table)
            dumped = "\n".join(json_.dumps(r, sort_keys=True) for r in records)
            (output / filename).write_text(dumped, "utf-8")
            filenames.append(output / filename)
        if yaml:
            filename = "{}.yml".format(table)
            dumped = yaml_.dump(records, sort_keys=True)
            (output / filename).write_text(dumped, "utf-8")
            filenames.append(output / filename)
        if csv:  # CSV handling
            filename = f"{table}.csv"
            with open(output / filename, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv_module.DictWriter(csvfile, fieldnames=records[0].keys())
                writer.writeheader()
                writer.writerows(records)
            filenames.append(output / filename)
        if verbose:
            click.echo(
                "Wrote {} record{} to {}".format(
                    len(records),
                    "" if len(records) == 1 else "s",
                    ", ".join(map(str, filenames)),
                ),
                err=True,
            )


def list_tables(base_id, api_key, user_agent=None):
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    headers = {"Authorization": "Bearer {}".format(api_key)}
    if user_agent is not None:
        headers["user-agent"] = user_agent
    return httpx.get(url, headers=headers).json()


def all_records(base_id, table, api_key, http_read_timeout, sleep=0.2, user_agent=None):
    headers = {"Authorization": "Bearer {}".format(api_key)}
    if user_agent is not None:
        headers["user-agent"] = user_agent

    if http_read_timeout:
        timeout = httpx.Timeout(5, read=http_read_timeout)
        client = httpx.Client(timeout=timeout)
    else:
        client = httpx

    first = True
    offset = None
    while first or offset:
        first = False
        url = "https://api.airtable.com/v0/{}/{}".format(base_id, quote(table, safe=""))
        if offset:
            url += "?" + urlencode({"offset": offset})
        response = client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        offset = data.get("offset")
        yield from data["records"]
        if offset and sleep:
            time.sleep(sleep)


def str_representer(dumper, data):
    try:
        if "\n" in data:
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    except TypeError:
        pass
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


yaml_.add_representer(str, str_representer)

if __name__ == "__main__":
    cli()
