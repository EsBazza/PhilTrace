import urllib.request
import os
import pyarrow.parquet as pq

file_url = "https://huggingface.co/datasets/bettergovph/dpwh-transparency-data/resolve/main/dpwh_transparency_data.parquet"
out_path = "dpwh_transparency_data.parquet"

if not os.path.exists(out_path):
    print(f"Downloading {file_url} (23.2 MB)...")
    urllib.request.urlretrieve(file_url, out_path)
    print("Download finished!")

table = pq.read_table(out_path)
print(f"Total Rows in Dataset: {table.num_rows:,}")
print(f"Columns: {table.column_names}")
