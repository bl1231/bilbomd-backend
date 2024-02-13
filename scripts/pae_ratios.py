"""
Provides functions to create const.inp file from PAE and CRD files
"""

import argparse
import json
from collections import defaultdict

import igraph
import numpy


def first_residue_number(crd):
    """
    Returns the first residue from CRD file
    """
    first_resnum = None
    with open(file=crd, mode="r", encoding="utf8") as infile:
        read_next_line = False
        for line in infile:
            if read_next_line:
                line_crd = line.split()
                if len(line_crd) >= 8:
                    first_resnum = line_crd[1]
                read_next_line = False
            words = line.split()
            if len(words) >= 2 and words[1] == "EXT":
                read_next_line = True
    return int(first_resnum)


def last_residue_number(crd):
    """
    Returns the last residue from CRD file
    """
    with open(file=crd, mode="r", encoding="utf8") as infile:
        lines = infile.readlines()
        if lines:
            line_crd = lines[-1].split()
            last_resnum = line_crd[1]
    return int(last_resnum)


def segment_id(crd, residue):
    """
    Returns segment ID
    """
    seg_id = None
    with open(file=crd, mode="r", encoding="utf8") as infile:
        for line in infile:
            words = line.split()
            if len(words) == 10 and words[1] == residue:
                seg_id = words[7]
                break
    return seg_id


def define_segments(crd_file: str):
    """
    Defines segments. But what is it actually doing?
    """
    differing_pairs = []
    with open(file=crd_file, mode="r", encoding="utf8") as infile:
        current_line = infile.readline().split()
        line_number = 1
        for line in infile:
            line_number += 1
            next_line = line.split()

            if (
                len(current_line) == 10
                and len(next_line) == 10
                and current_line[7] != next_line[7]
            ):
                differing_pairs.append(int(current_line[1]) - 1)
            current_line = next_line  # Move to the next line
    return differing_pairs


def correct_json_brackets(pae, output_file_path):
    """
    Removes the leading '[' and trailing ']' from a JSON-like string in the
    file, if present, and writes the result to an output file.
    """
    with open(file=pae, mode="r", encoding="utf8") as infile, open(
        file=output_file_path, mode="w", encoding="utf8"
    ) as output_file_handle:
        # Read the content of the file as a string
        json_content = infile.read()
        # Check if the string starts with '[' and ends with ']'
        if json_content.startswith("[") and json_content.endswith("]"):
            # Remove the first and last characters
            corrected_content = json_content[1:-1]
            output_file_handle.write(corrected_content)
        else:
            # Write the original content if it doesn't start
            # with '[' and end with ']'
            output_file_handle.write(json_content)


def define_clusters_for_selected_pae(pae, row_start, row_end, col_start, col_end):
    """
    Define PAE clusters
    """
    with open(file=pae, mode="r", encoding="utf8") as json_file:
        data = json.load(json_file)

    if "pae" in data:
        matrix = data["pae"]
    elif "predicted_aligned_error" in data:
        matrix = data["predicted_aligned_error"]
    else:
        raise ValueError("Invalid PAE JSON format.")

    selected_matrix = []

    for i, row in enumerate(matrix):
        if int(row_start) <= i <= int(row_end):
            new_row = [
                value if int(col_start) <= j <= int(col_end) else 30.0
                for j, value in enumerate(row)
            ]
            selected_matrix.append(new_row)

    selected_data = {"predicted_aligned_error": selected_matrix}

    if "predicted_aligned_error" not in selected_data:
        raise ValueError("Invalid PAE JSON format.")

    pae_matrix = numpy.array(
        selected_data["predicted_aligned_error"], dtype=numpy.float64
    )

    pae_power = 1.4
    pae_cutoff = 10
    graph_resolution = 1
    # Avoid divide-by-zero by adding a small epsilon value to the denominator
    epsilon = 1e-6  # You can adjust this value based on your specific needs
    weights = 1 / (pae_matrix + epsilon) ** pae_power

    g = igraph.Graph()
    size = weights.shape[0]
    g.add_vertices(range(size))
    edges = numpy.argwhere(pae_matrix < pae_cutoff)
    sel_weights = weights[edges.T[0], edges.T[1]]
    g.add_edges(edges)
    g.es["weight"] = sel_weights

    vc = g.community_leiden(
        weights="weight", resolution=graph_resolution / 100, n_iterations=-1
    )
    membership = numpy.array(vc.membership)

    membership_clusters = defaultdict(list)
    for index, cluster in enumerate(membership):
        membership_clusters[cluster].append(index)

    # Directly sort the cluster values by their length in descending order
    sorted_clusters = sorted(membership_clusters.values(), key=len, reverse=True)
    return sorted_clusters


def is_float(s):
    """
    Returns Boolean if arg is a float
    """
    try:
        float(s)
        return True
    except ValueError:
        return False


def calculate_average_bfactor(numbers):
    """
    Calculates numerical average
    """
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def separate_into_regions(numbers):
    """
    Seprates into regions
    """
    regions = []
    current_region = [numbers[0]]
    for i in range(1, len(numbers)):
        if numbers[i] == numbers[i - 1] + 1:
            current_region.append(numbers[i])
        else:
            regions.append(current_region)
            current_region = [numbers[i]]

    regions.append(current_region)
    return regions


def define_rigid_clusters(cluster_list: list, crd_file: str, first_resnum: int) -> list:
    """
    Define a rigid cluster
    """
    # print(chain_segment_list)
    rb = []
    for row in cluster_list:
        pairs = []
        if len(row) >= 5:
            numbers = [int(num) for num in row]
            print(f"{len(row)} - {numbers}")
            # consecutive_regions = separate_into_regions(numbers, chain_segment_list)
            consecutive_regions = separate_into_regions(numbers)
            for region in consecutive_regions:
                first_resnum_cluster = region[0]
                last_resnum_cluster = region[-1]
                # check which rigid domains  are rigid and
                # which are flexbible based on avearge Bfactor
                average_bfactor = []
                with open(file=crd_file, mode="r", encoding="utf8") as infile:
                    for line in infile:
                        words = line.split()
                        if (
                            len(words) >= 10
                            and is_float(words[9])
                            and not words[0].startswith("*")
                        ):
                            if float(words[9]) > 0.0:
                                bfactor = words[9]
                                resnum = words[1]

                                if (
                                    bfactor.replace(".", "", 1).isdigit()
                                    and (
                                        int(resnum)
                                        >= first_resnum_cluster + first_resnum
                                    )
                                    and (
                                        int(resnum)
                                        <= last_resnum_cluster + first_resnum
                                    )
                                ):
                                    average_bfactor.append(float(bfactor))
                average = calculate_average_bfactor(average_bfactor)

                if average > B_THRESHOLD:
                    with open(file=crd_file, mode="r", encoding="utf8") as infile:
                        for line in infile:
                            words = line.split()
                            if (
                                len(words) >= 10
                                and is_float(words[9])
                                and not words[0].startswith("*")
                            ):
                                if int(words[1]) == first_resnum_cluster + first_resnum:
                                    str1 = int(words[8])
                                elif (
                                    int(words[1]) == last_resnum_cluster + first_resnum
                                ):
                                    str2 = int(words[8])
                                    segid = words[7]

                    new_pair = (str1, str2, segid)
                    pairs.append(new_pair)
            rb.append(pairs)
    # increase the gap between rigid bodies
    rigid_body_optimized = []
    for row in rb:
        pairs_optimized = []
        for pair in row:
            residue_1 = pair[0]
            residue_2 = pair[1]
            segid = pair[2]

            for row in rb:
                for pair in row:
                    first_residue_b = pair[0]
                    # second_residue_b = pair[1]
                    segid_b = pair[2]
                    if int(residue_2) + 1 == int(first_residue_b) and segid == segid_b:
                        residue_2 = residue_2 - 3

            new_pair = (residue_1, residue_2, segid)
            pairs_optimized.append(new_pair)
        rigid_body_optimized.append(pairs_optimized)

    for row in rigid_body_optimized:
        if row:
            pass

    return rigid_body_optimized


def write_const_file(rigid_body, output_file):
    """
    Write const.inp file
    """
    dock_count = 0
    rigid_body_count = 0

    with open(file=output_file, mode="w", encoding="utf8") as outfile:
        for row in rigid_body:
            rigid_body_count += 1
            p = 0
            n = 0
            for pair in row:
                first_residue = pair[0]
                second_residue = pair[1]
                segment = pair[2]
                if rigid_body_count == 1:
                    p += 1
                    outfile.write(
                        f"define fixed{p} sele ( resid {first_residue}:{second_residue}"
                        f" .and. segid {segment} ) end\n"
                    )
                    if p == len(row):
                        outfile.write("cons fix sele ")
                        for number in range(1, p):
                            outfile.write(f"fixed{number} .or. ")
                        outfile.write(f"fixed{p} end \n")
                        outfile.write("\n")
                elif rigid_body_count > 1:
                    n += 1
                    outfile.write(
                        f"define rigid{n} sele ( resid {first_residue}:{second_residue}"
                        f" .and. segid {segment} ) end\n"
                    )
                    if n == len(row):
                        dock_count += 1
                        outfile.write(f"shape desc dock{dock_count} rigid sele ")
                        for number in range(1, n):
                            outfile.write(f"rigid{number} .or. ")
                        outfile.write(f"rigid{n} end \n")
                        outfile.write("\n")

        outfile.write("return \n")
        outfile.write("\n")


B_THRESHOLD = 50.00
CONST_FILE_PATH = "const.inp"
CLUSTER_FILE = "clusters.csv"
TEMP_FILE_JSON = "temp.json"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract pAE matrix for interacxtive region from an AlphaFold PAE matrix."
    )
    parser.add_argument("pae_file", type=str, help="Name of the PAE JSON file.")
    parser.add_argument("crd_file", type=str, help="Name of the CRD file.")
    args = parser.parse_args()

    first_residue = first_residue_number(args.crd_file)  # pylint: disable=invalid-name
    last_residues = last_residue_number(args.crd_file)

    # this doesn't appear to be actually doing anything...
    # chain_segments = define_segments(args.crd_file)
    # print(f"here in main - {chain_segments}")
    SELECTED_ROWS_START = str(int(first_residue) - 1)
    SELECTED_ROWS_END = str(int(last_residues) - 1)
    SELECTED_COLS_START = SELECTED_ROWS_START
    SELECTED_COLS_END = SELECTED_ROWS_END

    correct_json_brackets(args.pae_file, TEMP_FILE_JSON)

    pae_clusters = define_clusters_for_selected_pae(
        TEMP_FILE_JSON,
        SELECTED_ROWS_START,
        SELECTED_ROWS_END,
        SELECTED_COLS_START,
        SELECTED_COLS_END,
    )

    # rigid_body = define_rigid_clusters(
    #     pae_clusters, args.crd_file, first_residue, chain_segments
    # )
    rigid_body = define_rigid_clusters(pae_clusters, args.crd_file, first_residue)

    write_const_file(rigid_body, CONST_FILE_PATH)

    max_len = max(len(c) for c in pae_clusters)
    pae_clusters = [
        list(c) + [""] * (max_len - len(c)) for c in pae_clusters if len(c) > 2
    ]

    with open(file=CLUSTER_FILE, mode="wt", encoding="utf8") as outfile:
        for c in pae_clusters:
            outfile.write(",".join([str(e) for e in c]) + "\n")

    print(
        f"Wrote {len(pae_clusters)} clusters to {CLUSTER_FILE}. "
        f"The largest cluster contains {max_len} residues."
    )
    print(f"Wrote const.inp for  {args.crd_file}\n")
    print("done")
